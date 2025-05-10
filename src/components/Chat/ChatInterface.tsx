import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
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
      content: "Bonjour ! Je suis votre assistant email. Pour commencer, envoyez 'connecter email' pour configurer votre boîte mail.",
      timestamp: new Date(),
      direction: 'incoming'
    };

    // Vérifier si le message n'a pas déjà été envoyé
    if (!sentMessagesRef.current.has(welcomeMessage.id)) {
      setMessages([welcomeMessage]);
      sendMessageToCurrentUser(welcomeMessage.content).catch(console.error);
      sentMessagesRef.current.add(welcomeMessage.id);
    }
  }, []);
  
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
        .select('audio_enabled, voice_type')
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
            voice_type: 'alloy'
          });

        if (insertError) {
          throw new Error('Erreur lors de la création des paramètres: ' + insertError.message);
        }
      }

      const response = await generateResponse(inputValue, {
        generateAudio: settings?.audio_enabled ?? true,
        voiceType: settings?.voice_type ?? 'alloy',
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
        <Alert variant="destructive" className="mx-4 mb-4">
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
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
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
      </div>
    </div>
  );
};

export default ChatInterface;