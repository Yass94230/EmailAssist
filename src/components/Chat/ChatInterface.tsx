import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import Alert from '../ui/Alert';
import { Message } from '../../types';
import { generateResponse } from '../../services/claude';
import { sendMessageToCurrentUser } from '../../services/whatsapp';
import { generateEmailConnectionLink } from '../../services/email';

interface ChatInterfaceProps {
  phoneNumber: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ phoneNumber }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(true);
  const [voiceType, setVoiceType] = useState('alloy');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const supabase = useSupabaseClient();
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content: "Bonjour ! Je suis votre assistant email. Pour commencer, envoyez 'connecter email' pour configurer votre boîte mail. Vous pouvez aussi m'envoyer des messages vocaux !",
      timestamp: new Date(),
      direction: 'incoming'
    };

    // Vérifier si le message n'a pas déjà été envoyé
    if (!sentMessagesRef.current.has(welcomeMessage.id)) {
      setMessages([welcomeMessage]);
      sendMessageToCurrentUser(welcomeMessage.content).catch(console.error);
      sentMessagesRef.current.add(welcomeMessage.id);
    }
    
    // Charger les paramètres audio de l'utilisateur
    loadAudioSettings();
  }, []);
  
  const loadAudioSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_recognition_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .maybeSingle();
        
      if (error) throw error;
      
      if (data) {
        setIsAudioEnabled(data.audio_enabled ?? true);
        setIsVoiceRecognitionEnabled(data.voice_recognition_enabled ?? true);
        setVoiceType(data.voice_type || 'alloy');
      }
    } catch (err) {
      console.error('Erreur lors du chargement des paramètres audio:', err);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
        setAudioChunks(chunks);
        
        // Convertir en base64 pour l'envoi
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          // Retirer le préfixe "data:audio/mp3;base64,"
          const base64Audio = base64data.split(',')[1];
          
          // Créer et afficher un message temporaire pour l'audio
          const audioMessage: Message = {
            id: `msg-${Date.now()}-user-audio`,
            content: "Message audio en cours d'envoi...",
            timestamp: new Date(),
            direction: 'outgoing',
            audioUrl: base64data
          };
          
          setMessages(prev => [...prev, audioMessage]);
          
          // Envoyer l'audio à Claude pour traitement
          await handleAudioInput(base64Audio, audioMessage.id);
        };
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', err);
      setError('Impossible d\'accéder au microphone. Veuillez vérifier les permissions.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      // Arrêter tous les tracks pour libérer le microphone
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };
  
  const handleAudioInput = async (audioBase64: string, messageId: string) => {
    if (isLoading) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Obtenir l'utilisateur actuel
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new Error('Erreur d\'authentification: ' + authError.message);
      }
      
      if (!user) {
        throw new Error('Session expirée. Veuillez rafraîchir la page et vous reconnecter.');
      }

      // Obtenir une réponse de Claude basée sur l'audio
      const response = await generateResponse("", {
        generateAudio: isAudioEnabled,
        voiceType,
        phoneNumber,
        isAudioInput: true,
        audioData: audioBase64
      });
      
      // Mettre à jour le message audio de l'utilisateur avec la transcription
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: "Message vocal envoyé", transcription: response.text }
            : msg
        )
      );
      
      // Créer le message de réponse de l'assistant
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        content: response.text,
        timestamp: new Date(),
        direction: 'incoming',
        audioUrl: response.audioUrl
      };
      
      // Vérifier si le message n'a pas déjà été envoyé
      if (!sentMessagesRef.current.has(assistantMessage.id)) {
        setMessages(prev => [...prev, assistantMessage]);
        await sendMessageToCurrentUser(response.text);
        sentMessagesRef.current.add(assistantMessage.id);
      }
    } catch (error) {
      console.error('Error in handleAudioInput:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors du traitement du message audio';
      setError(errorMessage);
      
      // Mettre à jour le message pour indiquer l'erreur
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: "Erreur lors du traitement du message audio" }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setError(null);
    
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      content: inputValue,
      timestamp: new Date(),
      direction: 'outgoing'
    };
    
    // Vérifier si le message n'a pas déjà été envoyé
    if (sentMessagesRef.current.has(userMessage.id)) {
      return;
    }
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    sentMessagesRef.current.add(userMessage.id);
    
    try {
      // Get the current user's ID
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new Error('Erreur d\'authentification: ' + authError.message);
      }
      
      if (!user) {
        const authErrorMessage = 'Session expirée. Veuillez rafraîchir la page et vous reconnecter.';
        setError(authErrorMessage);
        // Remove the user message since we couldn't process it
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
        sentMessagesRef.current.delete(userMessage.id);
        return;
      }

      // Check if the user wants to connect email
      if (inputValue.toLowerCase().includes('connecter email')) {
        const connectionLink = await generateEmailConnectionLink(phoneNumber);
        const response: Message = {
          id: `msg-${Date.now()}-assistant`,
          content: `Pour connecter votre compte email, cliquez sur ce lien :\n\n${connectionLink}\n\nCe lien est valable pendant 24 heures et ne peut être utilisé qu'une seule fois pour des raisons de sécurité.`,
          timestamp: new Date(),
          direction: 'incoming'
        };

        if (!sentMessagesRef.current.has(response.id)) {
          setMessages(prev => [...prev, response]);
          await sendMessageToCurrentUser(response.content);
          sentMessagesRef.current.add(response.id);
        }
        
        setIsLoading(false);
        return;
      }

      // Get user settings or create with defaults if they don't exist
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_recognition_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (settingsError) {
        throw new Error('Erreur lors de la récupération des paramètres: ' + settingsError.message);
      }

      // If no settings exist, create them with defaults
      if (!settings) {
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            phone_number: phoneNumber,
            user_id: user.id,
            audio_enabled: true,
            voice_recognition_enabled: true,
            voice_type: 'alloy'
          });

        if (insertError) {
          throw new Error('Erreur lors de la création des paramètres: ' + insertError.message);
        }
      }

      const response = await generateResponse(inputValue, {
        generateAudio: settings?.audio_enabled ?? isAudioEnabled,
        voiceType: settings?.voice_type ?? voiceType,
        phoneNumber
      });
      
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        content: response.text,
        timestamp: new Date(),
        direction: 'incoming',
        audioUrl: response.audioUrl
      };
      
      // Vérifier si le message n'a pas déjà été envoyé
      if (!sentMessagesRef.current.has(assistantMessage.id)) {
        setMessages(prev => [...prev, assistantMessage]);
        await sendMessageToCurrentUser(response.text);
        sentMessagesRef.current.add(assistantMessage.id);
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'envoi du message';
      setError(errorMessage);
      // Remove the user message if we couldn't process it
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      sentMessagesRef.current.delete(userMessage.id);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-100">
      <ChatHeader phoneNumber={phoneNumber} />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {error && (
        <Alert variant="error" className="mx-4 mb-4">
          {error}
        </Alert>
      )}
      
      <div className="bg-white p-4 border-t border-gray-200">
        <div className="flex items-end space-x-2">
          <textarea
            placeholder="Écrivez votre message..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={1}
            disabled={isLoading || isRecording}
          />
          
          {isVoiceRecognitionEnabled && (
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`p-2 rounded-full ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'
              }`}
              title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
            >
              {isRecording ? (
                <MicOff size={20} className="text-white" />
              ) : (
                <Mic size={20} className="text-white" />
              )}
            </Button>
          )}
          
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || isRecording || !inputValue.trim()}
            className="p-2 rounded-full"
            variant="primary"
          >
            {isLoading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <Send size={20} />
            )}
          </Button>
        </div>
        
        {isRecording && (
          <div className="mt-2 flex items-center justify-center">
            <div className="animate-pulse flex space-x-1">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
            </div>
            <span className="ml-2 text-sm text-red-500">Enregistrement en cours...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;