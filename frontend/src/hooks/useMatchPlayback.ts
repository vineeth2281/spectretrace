import { useState, useEffect, useRef } from "react";
import { MatchDetail } from "../utils/api";

export function useMatchPlayback(matchDetail: MatchDetail | null) {
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // Playback multiplier (1x, 2x, 5x, 10x, 20x)
  
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Reset timeline when match changes
  useEffect(() => {
    setPlaybackTime(0);
    setIsPlaying(false);
  }, [matchDetail]);

  const duration = matchDetail ? matchDetail.duration_ms : 0;

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const delta = time - previousTimeRef.current;
        
        setPlaybackTime((prev) => {
          // Playback speed scales match time elapsed
          const next = prev + delta * speed;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      previousTimeRef.current = time;
      if (isPlaying) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      previousTimeRef.current = null; // Reset delta baseline
      requestRef.current = requestAnimationFrame(animate);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speed, duration]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const seekTo = (ms: number) => {
    setPlaybackTime(Math.max(0, Math.min(ms, duration)));
  };

  return {
    playbackTime,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    seekTo,
    duration
  };
}
