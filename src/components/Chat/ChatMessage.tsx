import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, Download, MessageSquare } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { Message } from '../../types';
import { Button } from '../ui/Button';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isOutgoing = message.direction === 'outgoing';
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  
  useEffect(() => {
    if (message.audioUrl && waveformRef.current) {
      try {
        wavesurferRef.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: isOutgoing ? '#fff' : '#4B5563',
          progressColor: isOutgoing ? '#E5E7EB' : '#374151',
          cursorColor: 'transparent',
          barWidth: 2,
          barGap: 3,
          barRadius: 3,
          height: 30,
          normalize: true
        });
        
        wavesurferRef.current.on('ready', () => {
          setDuration(wavesurferRef.current?.getDuration() || 0);
          setIsAudioLoaded(true);
        });
        
        wavesurferRef.current.on('audioprocess', (time) => {
          setCurrentTime(time);
        });
        
        wavesurferRef.current.on('finish', () => {
          setIsPlaying(false);
        });
        
        wavesurferRef.current.load(message.audioUrl);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de WaveSurfer:', error);
        setIsAudioLoaded(false);
      }
      
      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
        }
      };
    }
  }, [message.audioUrl, isOutgoing]);
  
  const toggleAudio = () => {
    if (wavesurferRef.current && isAudioLoaded) {
      if (isPlaying) {
        wavesurferRef.current.pause();
      } else {
        wavesurferRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const downloadAudio = () => {
    if (message.audioUrl) {
      const a = document.createElement('a');
      a.href = message.audioUrl;
      a.download = `message-audio-${new Date().toISOString()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const toggleTranscription = () => {
    setShowTranscription(!showTranscription);
  };
  
  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[75%] rounded-lg p-3 ${
          isOutgoing 
            ? 'bg-green-500 text-white' 
            : 'bg-white text-gray-800 shadow-sm border border-gray-100'
        }`}
      >
        {/* Afficher le contenu du message */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        
        {/* Afficher la transcription si disponible et activée */}
        {message.transcription && (
          <div className="mt-2">
            {showTranscription ? (
              <div className="bg-gray-100 p-2 rounded text-gray-800 text-xs">
                <p className="font-medium mb-1">Transcription:</p>
                <p>{message.transcription}</p>
              </div>
            ) : (
              <button 
                onClick={toggleTranscription}
                className={`text-xs underline ${isOutgoing ? 'text-white' : 'text-gray-500'}`}
              >
                Afficher la transcription
              </button>
            )}
          </div>
        )}
        
        {/* Lecteur audio si disponible */}
        {message.audioUrl && (
          <div className={`mt-2 space-y-2 ${
            isOutgoing ? 'text-white' : 'text-gray-600'
          }`}>
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleAudio}
                disabled={!isAudioLoaded}
                variant="ghost"
                size="sm"
                className={`p-1 hover:bg-opacity-10 ${!isAudioLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </Button>
              <Volume2 size={16} />
              <span className="text-xs">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {message.direction === 'incoming' && (
                <MessageSquare size={14} className="ml-auto" title="Message généré par Claude" />
              )}
              <Button
                onClick={downloadAudio}
                variant="ghost"
                size="sm"
                className="p-1 hover:bg-opacity-10"
                title="Télécharger l'audio"
              >
                <Download size={14} />
              </Button>
            </div>
            <div ref={waveformRef} className="w-full" />
            {!isAudioLoaded && (
              <p className="text-xs italic opacity-75">
                Chargement de l'audio...
              </p>
            )}
          </div>
        )}
        
        <span className="text-xs opacity-75 block text-right mt-1">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;