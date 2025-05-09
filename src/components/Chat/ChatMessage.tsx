import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { Message } from '../../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isOutgoing = message.direction === 'outgoing';
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (message.audioUrl && waveformRef.current) {
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

      wavesurferRef.current.load(message.audioUrl);

      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current?.getDuration() || 0);
      });

      wavesurferRef.current.on('audioprocess', (time) => {
        setCurrentTime(time);
      });

      wavesurferRef.current.on('finish', () => {
        setIsPlaying(false);
      });

      return () => {
        wavesurferRef.current?.destroy();
      };
    }
  }, [message.audioUrl, isOutgoing]);

  const toggleAudio = () => {
    if (wavesurferRef.current) {
      if (isPlaying) {
        wavesurferRef.current.pause();
      } else {
        wavesurferRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[75%] rounded-lg p-3 ${
          isOutgoing 
            ? 'bg-green-500 text-white' 
            : 'bg-white text-gray-800'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        
        {message.audioUrl && (
          <div className={`mt-2 space-y-2 ${
            isOutgoing ? 'text-white' : 'text-gray-600'
          }`}>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAudio}
                className="p-1 rounded-full hover:bg-opacity-10 hover:bg-black"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <Volume2 size={16} />
              <span className="text-xs">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <div ref={waveformRef} className="w-full" />
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