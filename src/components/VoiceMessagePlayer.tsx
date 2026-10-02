import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceMessagePlayerProps {
  mediaUrl: string;
  duration?: number;
  isCurrentUser: boolean;
}

export default function VoiceMessagePlayer({
  mediaUrl,
  duration = 0,
  isCurrentUser,
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(mediaUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback note:', err);
          setIsPlaying(false);
        });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress =
    totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  // Waveform bar heights (aesthetic representation of audio amplitude)
  const barHeights = [20, 45, 80, 60, 30, 75, 90, 50, 70, 40, 65, 85, 30, 60, 45, 25];

  return (
    <div className="flex items-center gap-2.5 py-1">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 ${
          isCurrentUser
            ? 'bg-white text-indigo-700 shadow-md hover:bg-slate-100'
            : 'bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-md shadow-pink-500/20 hover:scale-105'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Voice Waveform and Duration */}
      <div className="flex min-w-[130px] flex-1 flex-col justify-center">
        {/* Animated / Static Waveform bars */}
        <div className="flex items-center gap-1 h-6">
          {barHeights.map((height, i) => {
            const barProgress = (i / barHeights.length) * 100;
            const isPassed = progress >= barProgress;
            return (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPassed
                    ? isCurrentUser
                      ? 'bg-white'
                      : 'bg-pink-400'
                    : isCurrentUser
                      ? 'bg-white/35'
                      : 'bg-white/20'
                } ${isPlaying && isPassed ? 'scale-y-110' : ''}`}
              />
            );
          })}
        </div>

        {/* Duration / Progress Text */}
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
          <span
            className={
              isCurrentUser ? 'text-blue-100 font-semibold' : 'text-slate-400'
            }
          >
            {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
          </span>
          <span
            className={`flex items-center gap-1 text-[9px] ${
              isCurrentUser ? 'text-blue-200' : 'text-pink-400/80'
            }`}
          >
            <Mic className="h-2.5 w-2.5" />
            <span>Voice</span>
          </span>
        </div>
      </div>
    </div>
  );
}
