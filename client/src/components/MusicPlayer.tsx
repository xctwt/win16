import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import { Window } from "./Windows";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Loader2,
  List,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

interface Track {
  title: string;
  artist: string;
  url: string;
}

export const MusicPlayer = memo(function MusicPlayer() {
  const [currentSong, setCurrentSong] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const defaultWindowPosition = useMemo(() => ({ x: 95, y: 21 }), []);

  // Memoize icons to prevent unnecessary re-renders
  const skipBackIcon = useMemo(() => <SkipBack className="w-4 h-4" />, []);
  const skipForwardIcon = useMemo(
    () => <SkipForward className="w-4 h-4" />,
    [],
  );
  const pauseIcon = useMemo(() => <Pause className="w-4 h-4" />, []);
  const playIcon = useMemo(() => <Play className="w-4 h-4" />, []);
  const listIcon = useMemo(() => <List className="w-4 h-4" />, []);
  const closeIcon = useMemo(() => <X className="w-4 h-4" />, []);
  const volumeIcon = useMemo(() => <Volume2 className="w-4 h-4" />, []);

  const fetchTracks = async (): Promise<Track[]> => {
    const response = await fetch("/api/tracks");
    if (!response.ok) throw new Error("Failed to load tracks");
    return response.json();
  };

  const query: UseQueryResult<Track[], Error> = useQuery({
    queryKey: ["tracks"],
    queryFn: fetchTracks,
  });

  const tracks: Track[] = query.data || [];
  const isLoading = query.isLoading;

  // Handle query error
  useEffect(() => {
    if (query.error) {
      toast({
        title: "Error loading tracks",
        description: query.error.message,
        variant: "destructive",
      });
    }
  }, [query.error, toast]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle audio loading and playback when track changes
  useEffect(() => {
    if (audioRef.current && tracks.length > 0) {
      // Load the new track
      audioRef.current.load();
      // Reset time when changing tracks
      setCurrentTime(0);

      if (isPlaying) {
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
          toast({
            title: "Error playing audio",
            description: `Could not play ${tracks[currentSong]?.title}`,
            variant: "destructive",
          });
          setIsPlaying(false);
        });
      }
    }
  }, [currentSong, tracks, toast]);

  // Handle play/pause state changes without reloading the audio
  useEffect(() => {
    if (audioRef.current && tracks.length > 0 && isPlaying) {
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
        toast({
          title: "Error playing audio",
          description: `Could not play ${tracks[currentSong]?.title}`,
          variant: "destructive",
        });
        setIsPlaying(false);
      });
    }
  }, [isPlaying, tracks, currentSong, toast]);

  useEffect(() => {
    if (tracks.length > 0 && currentSong < tracks.length) {
      const currentTrack = tracks[currentSong];
      if (!currentTrack) return;

      const text = `${currentTrack.artist} - ${currentTrack.title}`;
      const textWidth = text.length * 8;
      const containerWidth = 256;

      if (textWidth > containerWidth) {
        setScrollPosition(0);
        const interval = setInterval(() => {
          setScrollPosition((prev) => {
            if (prev <= -(textWidth + 40)) return 0;
            return prev - 1;
          });
        }, 50);

        return () => clearInterval(interval);
      } else {
        setScrollPosition(0);
      }
    }
  }, [currentSong, tracks]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // When resuming, ensure we're at the correct position
        audioRef.current.currentTime = currentTime;
        setIsPlaying(true);
      }
    }
  };

  const prevSong = () => {
    if (tracks.length > 0) {
      setCurrentSong((prev) => (prev - 1 + tracks.length) % tracks.length);
    }
  };

  const nextSong = () => {
    if (tracks.length > 0) {
      setCurrentSong((prev) => (prev + 1) % tracks.length);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime;
      const newDuration = audioRef.current.duration || 0;

      setCurrentTime(newTime);
      setDuration(newDuration);

      // Update Media Session position state
      if (
        "mediaSession" in navigator &&
        "setPositionState" in navigator.mediaSession
      ) {
        navigator.mediaSession.setPositionState({
          duration: newDuration,
          playbackRate: audioRef.current.playbackRate,
          position: newTime,
        });
      }
    }
  };

  const handleEnded = () => {
    nextSong();
    setIsPlaying(true);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || time === 0) {
      return "0:00";
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const playTrack = (index: number) => {
    setCurrentSong(index);
    setIsPlaying(true);
  };

  // Safely access track at current index
  const currentTrack =
    tracks.length > 0 && currentSong < tracks.length
      ? tracks[currentSong]
      : null;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration) {
      const progressBar = e.currentTarget;
      const rect = progressBar.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newTime = (offsetX / rect.width) * duration;

      // Update audio time
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = offsetX / rect.width;
      const previewTime = percentage * duration;

      setHoverTime(previewTime);
      setHoverPosition(offsetX);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
  };

  // Set up Media Session API for media controls
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        // Add artwork if available in the future
      });

      // Define action handlers
      navigator.mediaSession.setActionHandler("play", () => {
        if (!isPlaying) togglePlay();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        if (isPlaying) togglePlay();
      });

      navigator.mediaSession.setActionHandler("previoustrack", prevSong);
      navigator.mediaSession.setActionHandler("nexttrack", nextSong);

      // Add seek handlers
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });

      // Update position state
      if ("setPositionState" in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: duration || 0,
          playbackRate: audioRef.current?.playbackRate || 1,
          position: currentTime || 0,
        });
      }
    }

    return () => {
      if ("mediaSession" in navigator) {
        // Clear handlers when component unmounts
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      }
    };
  }, [
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    togglePlay,
    prevSong,
    nextSong,
  ]);

  return (
    <Window
      title="player"
      windowId="music"
      defaultPosition={defaultWindowPosition}
    >
      <div className="w-64 space-y-4 p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : tracks.length > 0 ? (
          <>
            <audio
              ref={audioRef}
              src={currentTrack?.url}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              onError={(e) => {
                console.error("Audio error:", e);
                toast({
                  title: "Error loading audio",
                  description: `Could not load ${currentTrack?.title}`,
                  variant: "destructive",
                });
              }}
            />

            <div className="text-center font-bold h-6 overflow-hidden whitespace-nowrap">
              <div
                className="inline-block"
                style={{ transform: `translateX(${scrollPosition}px)` }}
              >
                {currentTrack?.artist} - {currentTrack?.title}
                {currentTrack?.artist &&
                  currentTrack?.title &&
                  (currentTrack.artist.length + currentTrack.title.length) * 8 >
                    256 && (
                    <>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      {currentTrack.artist} - {currentTrack.title}
                    </>
                  )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2 relative">
              <div
                ref={progressBarRef}
                className="progress-bar cursor-pointer relative"
                onClick={handleSeek}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${(currentTime / (duration || 1)) * 100 || 0}%`,
                  }}
                />
                {hoverTime !== null && hoverPosition !== null && (
                  <>
                    {/* Hover position indicator */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white"
                      style={{
                        left: `${hoverPosition}px`,
                        transform: "translateX(-50%)",
                        opacity: 0.8,
                      }}
                    />
                    {/* Hover time tooltip */}
                    <div
                      className="absolute bottom-full mb-1 px-1 py-0.5 bg-black text-white text-xs rounded"
                      style={{
                        left: `${hoverPosition}px`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      {formatTime(hoverTime)}
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-between text-xs">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <button className="cs-button" onClick={prevSong}>
                {skipBackIcon}
              </button>
              <button className="cs-button" onClick={togglePlay}>
                {isPlaying ? pauseIcon : playIcon}
              </button>
              <button className="cs-button" onClick={nextSong}>
                {skipForwardIcon}
              </button>
              <button
                className={`cs-button ${showPlaylist ? "border-cs-text" : ""}`}
                onClick={() => setShowPlaylist(!showPlaylist)}
              >
                {showPlaylist ? closeIcon : listIcon}
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center space-x-2">
              {volumeIcon}
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
              />
            </div>

            {showPlaylist && (
              <div className="border border-cs-border mt-2">
                <div className="max-h-48 overflow-y-auto">
                  {tracks.map((track, index) => (
                    <button
                      key={index}
                      onClick={() => playTrack(index)}
                      className={`w-full text-left p-2 hover:bg-cs-hover
                        ${currentSong === index ? "border border-cs-text" : "border-transparent border"}`}
                    >
                      <div className="truncate text-sm">
                        {track.artist} - {track.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            No tracks available in /assets/music
          </div>
        )}
      </div>
    </Window>
  );
});
