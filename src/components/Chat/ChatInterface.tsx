import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
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

// Formats audio supportés
const SUPPORTED_MIME_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/wav',
  'audio/ogg'
];

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
  const session = useSession();

  // Fonction pour faire défiler automatiquement jusqu'au dernier message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Défilement automatique quand de nouveaux messages sont ajoutés
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Nettoyage des ressources du MediaRecorder quand le composant est démonté
  useEffect(() => {
    return () => {
      if (mediaRecorder) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);
  
  // Initialisation des messages de bienvenue et des paramètres audio
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content: "Bonjour ! Je suis votre assistant email. Pour commencer, envoyez 'connecter email' pour configurer votre boîte mail. Vous pouvez aussi m'envoyer des messages vocaux !",
      timestamp: new Date(),
      direction: 'incoming'
    };

    if (!sentMessagesRef.current.has(welcomeMessage.id)) {
      setMessages([welcomeMessage]);
      sendMessageToCurrentUser(welcomeMessage.content).catch(err => {
        console.error("Erreur lors de l'envoi du message de bienvenue:", err);
      });
      sentMessagesRef.current.add(welcomeMessage.id);
    }
    
    loadAudioSettings();
  }, []);
  
  // Chargement des paramètres audio depuis Supabase
  const loadAudioSettings = async () => {
    try {
      console.log("Chargement des paramètres audio pour:", phoneNumber);
      const { data, error } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_recognition_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .maybeSingle();
        
      if (error) {
        console.error("Erreur lors du chargement des paramètres audio:", error);
        throw error;
      }
      
      if (data) {
        console.log("Paramètres audio chargés:", data);
        setIsAudioEnabled(data.audio_enabled ?? true);
        setIsVoiceRecognitionEnabled(data.voice_recognition_enabled ?? true);
        setVoiceType(data.voice_type || 'alloy');
      } else {
        console.log("Aucun paramètre audio trouvé, utilisation des valeurs par défaut");
      }
    } catch (err) {
      console.error('Erreur lors du chargement des paramètres audio:', err);
    }
  };

  // Fonction pour vérifier si le format audio est supporté
  const getSupportedMimeType = (): string | null => {
    return SUPPORTED_MIME_TYPES.find(mimeType => MediaRecorder.isTypeSupported(mimeType)) || null;
  };
  
  // Démarrage de l'enregistrement audio
  const startRecording = async () => {
    try {
      console.log("Demande d'accès au microphone...");
      
      // Vérifier si la reconnaissance vocale est activée
      if (!isVoiceRecognitionEnabled) {
        setError("La reconnaissance vocale est désactivée dans vos paramètres. Veuillez l'activer dans les réglages.");
        return;
      }

      // Vérifier le support du format audio
      const supportedMimeType = getSupportedMimeType();
      if (!supportedMimeType) {
        setError("Votre navigateur ne supporte pas les formats audio requis (WebM, MP3 ou WAV)");
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType
      });
      
      setMediaRecorder(recorder);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        console.log("Enregistrement audio terminé");
        
        try {
          // Création d'un blob avec le type MIME approprié
          const audioBlob = new Blob(chunks, { type: supportedMimeType });
          setAudioChunks(chunks);
          
          // Vérification de la taille du blob
          if (audioBlob.size < 1000) {
            throw new Error("L'enregistrement audio est trop court ou vide");
          }

          if (audioBlob.size > 10 * 1024 * 1024) {
            throw new Error("L'enregistrement audio est trop volumineux (maximum 10MB)");
          }
          
          console.log(`Taille du blob audio: ${audioBlob.size} octets`);
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            if (!base64data || base64data.length < 100) {
              throw new Error("Conversion audio en base64 échouée");
            }
            
            const base64Audio = base64data.split(',')[1];
            
            const audioMessage: Message = {
              id: `msg-${Date.now()}-user-audio`,
              content: "Message audio en cours d'envoi...",
              timestamp: new Date(),
              direction: 'outgoing',
              audioUrl: base64data
            };
            
            setMessages(prev => [...prev, audioMessage]);
            
            await handleAudioInput(base64Audio, audioMessage.id);
          };
          
          reader.onerror = (error) => {
            console.error("Erreur lors de la lecture du fichier audio:", error);
            setError("Erreur lors de la lecture de l'enregistrement audio");
          };
        } catch (error) {
          console.error("Erreur lors du traitement de l'enregistrement:", error);
          setError(error instanceof Error ? error.message : "Erreur lors du traitement de l'enregistrement");
        }
      };
      
      recorder.start();
      setIsRecording(true);
      console.log("Enregistrement audio démarré");
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', err);
      
      let errorMsg = "Impossible d'accéder au microphone. Veuillez vérifier les permissions.";
      
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          errorMsg = "L'accès au microphone a été refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.";
        } else if (err.name === 'NotFoundError') {
          errorMsg = "Aucun microphone détecté. Veuillez connecter un microphone et réessayer.";
        } else if (err.name === 'NotSupportedError') {
          errorMsg = "Votre navigateur ne supporte pas l'enregistrement audio. Veuillez utiliser un navigateur plus récent.";
        }
      }
      
      setError(errorMsg);
    }
  };
  
  // Arrêt de l'enregistrement audio
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      console.log("Arrêt de l'enregistrement audio");
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };
  
  // Traitement d'un message audio
  const handleAudioInput = async (audioBase64: string, messageId: string) => {
    if (isLoading || !session) {
      console.log("Impossible de traiter l'audio:", { isLoading, hasSession: !!session });
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Validation des données audio
      if (!audioBase64) {
        throw new Error("Données audio manquantes");
      }
      
      if (audioBase64.length < 100) {
        throw new Error("Enregistrement audio trop court ou incomplet");
      }
      
      console.log("Traitement du message audio...", {
        taille: audioBase64.length,
        debut: audioBase64.substring(0, 20) + '...'
      });

      // Vérification si la reconnaissance vocale est activée
      if (!isVoiceRecognitionEnabled) {
        throw new Error("La reconnaissance vocale est désactivée dans vos paramètres");
      }

      // Tentative de traitement audio
      try {
        const response = await generateResponse("", {
          generateAudio: isAudioEnabled,
          voiceType,
          phoneNumber,
          isAudioInput: true,
          audioData: audioBase64
        });
        
        if (!response || (!response.text && !response.audioUrl)) {
          throw new Error("Réponse invalide du serveur");
        }
        
        console.log("Réponse audio générée avec succès");
        
        // Mise à jour du message d'envoi
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: "Message vocal envoyé", transcription: response.text }
              : msg
          )
        );
        
        // Création du message de réponse
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          content: response.text,
          timestamp: new Date(),
          direction: 'incoming',
          audioUrl: response.audioUrl
        };
        
        if (!sentMessagesRef.current.has(assistantMessage.id)) {
          setMessages(prev => [...prev, assistantMessage]);
          await sendMessageToCurrentUser(response.text);
          sentMessagesRef.current.add(assistantMessage.id);
        }
      } catch (audioProcessingError) {
        console.error("Erreur lors du traitement audio, tentative de repli texte:", audioProcessingError);
        
        // Mise à jour du message utilisateur pour indiquer le problème
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: "Message vocal (traitement de secours)" }
              : msg
          )
        );
        
        // Tentative de traitement texte sans audio
        const fallbackResponse = await generateResponse(
          "L'utilisateur a envoyé un message vocal qui n'a pas pu être traité. Merci de lui demander de réessayer ou d'envoyer un message texte.", 
          {
            generateAudio: false,
            phoneNumber,
            isAudioInput: false
          }
        );
        
        const fallbackMessage: Message = {
          id: `msg-${Date.now()}-assistant-fallback`,
          content: fallbackResponse.text,
          timestamp: new Date(),
          direction: 'incoming'
        };
        
        if (!sentMessagesRef.current.has(fallbackMessage.id)) {
          setMessages(prev => [...prev, fallbackMessage]);
          await sendMessageToCurrentUser(fallbackResponse.text);
          sentMessagesRef.current.add(fallbackMessage.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message audio:', error);
      
      // Amélioration du message d'erreur
      let errorMessage = "Une erreur est survenue lors du traitement du message audio";
      
      if (error instanceof Error) {
        if (error.message.includes("reconnaissance vocale est désactivée")) {
          errorMessage = "La reconnaissance vocale est désactivée dans vos paramètres. Veuillez l'activer dans les réglages ou envoyer un message texte.";
        } else if (error.message.includes("trop court")) {
          errorMessage = "L'enregistrement audio est trop court. Veuillez parler plus longtemps.";
        } else if (error.message.includes("trop volumineux")) {
          errorMessage = "L'enregistrement audio est trop long. Veuillez enregistrer un message plus court.";
        } else if (error.message.includes("invalide") || error.message.includes("incomplet")) {
          errorMessage = "Format audio non reconnu. Veuillez réessayer.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      
      // Mise à jour du message utilisateur pour indiquer l'erreur
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: "Erreur: " + errorMessage }
            : msg
        )
      );
      
      // Message d'erreur de l'assistant
      const errorResponse: Message = {
        id: `msg-${Date.now()}-error`,
        content: `Désolé, une erreur s'est produite: ${errorMessage}`,
        timestamp: new Date(),
        direction: 'incoming'
      };
      
      if (!sentMessagesRef.current.has(errorResponse.id)) {
        setMessages(prev => [...prev, errorResponse]);
        await sendMessageToCurrentUser(errorResponse.content).catch(err => {
          console.error("Erreur lors de l'envoi du message d'erreur:", err);
        });
        sentMessagesRef.current.add(errorResponse.id);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Envoi d'un message texte
  const handleSendMessage = async () => {
    if (!inputValue.trim()) {
      console.log("Message vide, annulation de l'envoi");
      return;
    }
    
    if (isLoading) {
      console.log("Déjà en cours de chargement, annulation de l'envoi");
      return;
    }
    
    if (!session) {
      console.log("Pas de session utilisateur, annulation de l'envoi");
      setError("Vous devez être connecté pour envoyer des messages.");
      return;
    }
    
    console.log("Préparation de l'envoi du message:", inputValue);
    setError(null);
    
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      content: inputValue,
      timestamp: new Date(),
      direction: 'outgoing'
    };
    
    if (sentMessagesRef.current.has(userMessage.id)) {
      console.log("Message déjà envoyé, évitement du doublon");
      return;
    }
    
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputValue;
    setInputValue('');
    setIsLoading(true);
    sentMessagesRef.current.add(userMessage.id);
    
    try {
      // Traitement spécial pour la commande "connecter email"
      if (messageToSend.toLowerCase().includes('connecter email')) {
        console.log("Détection de la commande 'connecter email'");
        try {
          console.log("Génération du lien de connexion pour:", phoneNumber);
          const connectionLink = await generateEmailConnectionLink(phoneNumber);
          
          if (!connectionLink) {
            throw new Error("Impossible de générer le lien de connexion");
          }
          
          console.log("Lien de connexion généré:", connectionLink);
          
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
        } catch (error) {
          console.error("Erreur lors de la génération du lien de connexion:", error);
          const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
          setError(`Erreur lors de la génération du lien de connexion: ${errorMsg}`);
          
          const errorResponse: Message = {
            id: `msg-${Date.now()}-error`,
            content: "Désolé, je n'ai pas pu générer le lien de connexion. Veuillez réessayer ou contacter le support.",
            timestamp: new Date(),
            direction: 'incoming'
          };
          
          setMessages(prev => [...prev, errorResponse]);
          setIsLoading(false);
          return;
        }
      }

      // Vérification et récupération des paramètres utilisateur
      console.log("Vérification des paramètres utilisateur");
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_recognition_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (settingsError) {
        console.error("Erreur lors de la récupération des paramètres:", settingsError);
        throw new Error('Erreur lors de la récupération des paramètres: ' + settingsError.message);
      }

      // Création des paramètres par défaut si non existants
      if (!settings) {
        console.log("Aucun paramètre trouvé, création par défaut");
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            phone_number: phoneNumber,
            user_id: session.user.id,
            audio_enabled: true,
            voice_recognition_enabled: true,
            voice_type: 'alloy'
          });

        if (insertError) {
          console.error("Erreur lors de la création des paramètres:", insertError);
          throw new Error('Erreur lors de la création des paramètres: ' + insertError.message);
        }
      }

      // Génération d'une réponse via Claude
      console.log("Génération d'une réponse Claude");
      const response = await generateResponse(messageToSend, {
        generateAudio: settings?.audio_enabled ?? isAudioEnabled,
        voiceType: settings?.voice_type ?? voiceType,
        phoneNumber
      });
      
      console.log("Réponse générée avec succès");
      
      // Création du message de réponse
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        content: response.text,
        timestamp: new Date(),
        direction: 'incoming',
        audioUrl: response.audioUrl
      };
      
      if (!sentMessagesRef.current.has(assistantMessage.id)) {
        setMessages(prev => [...prev, assistantMessage]);
        await sendMessageToCurrentUser(response.text);
        sentMessagesRef.current.add(assistantMessage.id);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      let errorMessage = "Une erreur est survenue lors de l'envoi du message";
      
      if (error instanceof Error) {
        if ('details' in error && typeof (error as any).details === 'string') {
          errorMessage = (error as any).details;
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      
      // Suppression du message utilisateur en cas d'erreur
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      sentMessagesRef.current.delete(userMessage.id);
      
      // Message d'erreur de l'assistant
      const errorResponse: Message = {
        id: `msg-${Date.now()}-error`,
        content: `Désolé, une erreur s'est produite: ${errorMessage}`,
        timestamp: new Date(),
        direction: 'incoming'
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Gestion de l'appui sur Entrée pour envoyer
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
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
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
            disabled={isLoading || isRecording || !session}
          />
          
          {isVoiceRecognitionEnabled && (
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || !session}
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
            disabled={isLoading || isRecording || !inputValue.trim() || !session}
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