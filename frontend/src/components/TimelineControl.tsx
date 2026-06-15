import React from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

interface TimelineControlProps {
  playbackTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  setSpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (ms: number) => void;
}

export const TimelineControl: React.FC<TimelineControlProps> = ({
  playbackTime,
  duration,
  isPlaying,
  speed,
  setSpeed,
  togglePlay,
  seekTo,
}) => {
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(e.target.value));
  };

  return (
    <div className="timeline-bar">
      <div className="play-controls">
        <button className="btn-icon" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="btn-icon" onClick={() => seekTo(0)} title="Restart">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="scrubber-container">
        <span className="time-display">{formatTime(playbackTime)}</span>
        <input
          type="range"
          className="scrubber"
          min={0}
          max={duration}
          value={playbackTime}
          onChange={handleSliderChange}
        />
        <span className="time-display">{formatTime(duration)}</span>
      </div>

      <div className="filters-group">
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Playback Speed:</span>
        <select
          className="filter-select"
          style={{ minWidth: "80px", padding: "4px 8px" }}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
          <option value={20}>20x</option>
        </select>
      </div>
    </div>
  );
};
