import { useState, useRef, useEffect } from 'react';
import { Window } from './Windows';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SONGS = [
  { 
    title: "Tsubi Club - Re-Laced Up", 
    url: "/assets/music/1-tsubi-club-re-laced-up-V8C8YY.mp3"
  }
];

export function MusicPlayer() {
  const [currentSong, setCurrentSong] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load(); // Force reload when song changes
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          toast({
            title: 'Error playing audio',
            description: `Could not play ${SONGS[currentSong].title}`,
            variant: 'destructive'
          });
          setIsPlaying(false);
        });
      }
    }
  }, [currentSong]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          toast({
            title: 'Error playing audio',
            description: `Could not play ${SONGS[currentSong].title}`,
            variant: 'destructive'
          });
        });
        setIsPlaying(true);
      }
    }
  };

  const prevSong = () => {
    setCurrentSong((prev) => (prev - 1 + SONGS.length) % SONGS.length);
    setIsPlaying(false);
  };

  const nextSong = () => {
    setCurrentSong((prev) => (prev + 1) % SONGS.length);
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Window title="player" windowId="music" defaultPosition={{ x: 20, y: 20 }}>
      <div className="w-64 space-y-4">
        <audio
          ref={audioRef}
          src={SONGS[currentSong].url}
          onEnded={nextSong}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            console.error('Audio error:', e);
            toast({
              title: 'Error loading audio',
              description: `Could not load ${SONGS[currentSong].title}`,
              variant: 'destructive'
            });
          }}
        />

        <div className="text-center font-bold">
          {SONGS[currentSong].title}
        </div>

        <div className="space-y-2">
          <div className="h-1 bg-gray-700 rounded">
            <div 
              className="h-full bg-white rounded"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <button className="cs-button" onClick={prevSong}>
            <SkipBack className="w-4 h-4" />
          </button>
          <button className="cs-button" onClick={togglePlay}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button className="cs-button" onClick={nextSong}>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value);
              if (audioRef.current) {
                audioRef.current.volume = newVolume;
              }
              setVolume(newVolume);
            }}
            className="w-full"
          />
        </div>
      </div>
    </Window>
  );
}