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

interface ChatInterfaceProps {
  phoneNumber: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ phoneNumber }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    
    setMessages([welcomeMessage]);
    sendMessageToCurrentUser(welcomeMessage.content).catch(console.error);
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
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Get user settings or create with defaults if they don't exist
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (settingsError) throw settingsError;

      // If no settings exist, create them with defaults
      if (!settings) {
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            phone_number: phoneNumber,
            audio_enabled: true,
            voice_type: 'alloy'
          });

        if (insertError) throw insertError;
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
      
      setMessages(prev => [...prev, assistantMessage]);
      await sendMessageToCurrentUser(response.text);
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setError('Une erreur est survenue lors de l\'envoi du message');
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