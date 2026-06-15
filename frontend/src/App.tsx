import React, { useState, useEffect } from "react";
import { FilterBar } from "./components/FilterBar";
import { MapCanvas } from "./components/MapCanvas";
import { InsightsPanel } from "./components/InsightsPanel";
import { TimelineControl } from "./components/TimelineControl";
import { useMatchPlayback } from "./hooks/useMatchPlayback";
import {
  uploadParquetFiles,
  uploadFolder,
  fetchMetadata,
  fetchMatches,
  fetchMatchDetail,
  clearUploadedFiles,
  MatchDetail
} from "./utils/api";
import confetti from "canvas-confetti";

export const App: React.FC = () => {
  const [selectedMap, setSelectedMap] = useState<string>("AmbroseValley");
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  
  // Toggles
  const [showBots, setShowBots] = useState<boolean>(true);
  const [showHumans, setShowHumans] = useState<boolean>(true);
  const [heatmapMode, setHeatmapMode] = useState<"kills" | "deaths" | "traffic" | "loot" | null>(null);
  const [heatmapRadius, setHeatmapRadius] = useState<number>(15);

  // Dynamic filter state
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [maps, setMaps] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [matches, setMatches] = useState<Array<{ match_id: string; date: string; human_count: number; bot_count: number }>>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  // Load initial metadata on mount
  useEffect(() => {
    fetchMetadata()
      .then((meta) => {
        setMaps(meta.maps);
        setDates(meta.dates);
        if (meta.total_matches > 0) {
          setIsDataLoaded(true);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch metadata", err);
      });
  }, []);

  // Fetch matches list when map or date filter changes
  useEffect(() => {
    setSelectedMatchId("");
    fetchMatches(selectedMap, selectedDate || undefined)
      .then((data) => {
        const mapped = data.map((m) => ({
          match_id: m.match_id,
          date: m.date,
          human_count: m.human_count,
          bot_count: m.bot_count,
        }));
        setMatches(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch matches", err);
      });
  }, [selectedMap, selectedDate]);

  // Auto-select first match when matches list changes
  useEffect(() => {
    if (matches.length > 0) {
      const exists = matches.some((m) => m.match_id === selectedMatchId);
      if (!exists) {
        setSelectedMatchId(matches[0].match_id);
      }
    } else {
      setSelectedMatchId("");
      setMatchDetail(null);
    }
  }, [matches, selectedMatchId]);

  // Fetch specific match details when a match is selected
  useEffect(() => {
    if (!selectedMatchId) return;
    fetchMatchDetail(selectedMatchId)
      .then((detail) => {
        setMatchDetail(detail);
      })
      .catch((err) => {
        alert("Failed to fetch match details: " + err.message);
      });
  }, [selectedMatchId]);

  // Playback integration
  const {
    playbackTime,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    seekTo,
    duration,
  } = useMatchPlayback(matchDetail);

  const handleFileUpload = (files: FileList) => {
    uploadParquetFiles(files)
      .then((detail) => {
        setSelectedMatchId("");
        // Switch visualization map boundary to match the uploaded file's map
        setSelectedMap(detail.map_id);
        setMatchDetail(detail);
        
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.8 },
          colors: ["#38bdf8", "#10b981", "#fbbf24"],
        });
      })
      .catch((err) => {
        alert(err.message || "Failed to parse telemetry file(s)");
      });
  };

  const handleFolderUpload = (files: FileList | File[]) => {
    uploadFolder(files)
      .then((res) => {
        alert(`Successfully uploaded ${res.total_files_uploaded} files!`);
        setSelectedMatchId("");
        setMaps(res.meta.maps);
        setDates(res.meta.dates);
        setIsDataLoaded(true);
        if (res.meta.maps.length > 0) {
          setSelectedMap(res.meta.maps[0]);
        }
      })
      .catch((err) => {
        alert(err.message || "Failed to upload folder");
      });
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to delete all uploaded telemetry files? This cannot be undone.")) {
      clearUploadedFiles()
        .then(() => {
          setMatchDetail(null);
          setSelectedMatchId("");
          setMatches([]);
          setMaps([]);
          setDates([]);
          setIsDataLoaded(false);
        })
        .catch((err) => {
          alert(err.message || "Failed to clear telemetry files");
        });
    }
  };

  return (
    <div className="dashboard-container">
      {/* Top filter select header */}
      <FilterBar
        showBots={showBots}
        setShowBots={setShowBots}
        showHumans={showHumans}
        setShowHumans={setShowHumans}
        heatmapMode={heatmapMode}
        setHeatmapMode={setHeatmapMode}
        onFileUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
        onClearData={handleClearData}
        heatmapRadius={heatmapRadius}
        setHeatmapRadius={setHeatmapRadius}
        isDataLoaded={isDataLoaded}
        maps={maps}
        selectedMap={selectedMap}
        setSelectedMap={setSelectedMap}
        dates={dates}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        matches={matches}
        selectedMatchId={selectedMatchId}
        setSelectedMatchId={setSelectedMatchId}
      />

      {/* Main splits view (Map visualizer + sidebar stats) */}
      <div className="main-layout">
        <MapCanvas
          matchDetail={matchDetail}
          playbackTime={playbackTime}
          isPlaying={isPlaying}
          showBots={showBots}
          showHumans={showHumans}
          heatmapMode={heatmapMode}
          selectedMap={selectedMap}
          heatmapRadius={heatmapRadius}
        />
        <InsightsPanel matchDetail={matchDetail} playbackTime={playbackTime} onSeekTo={seekTo} />
      </div>

      {/* Bottom scrubbing playback bar */}
      <TimelineControl
        playbackTime={playbackTime}
        duration={duration}
        isPlaying={isPlaying}
        speed={speed}
        setSpeed={setSpeed}
        togglePlay={togglePlay}
        seekTo={seekTo}
      />
    </div>
  );
};
export default App;
