import React from "react";
import { Upload, FolderOpen, Trash2 } from "lucide-react";

interface FilterBarProps {
  showBots: boolean;
  setShowBots: (show: boolean) => void;
  showHumans: boolean;
  setShowHumans: (show: boolean) => void;
  heatmapMode: "kills" | "deaths" | "traffic" | "loot" | null;
  setHeatmapMode: (mode: "kills" | "deaths" | "traffic" | "loot" | null) => void;
  onFileUpload: (files: FileList) => void;
  onFolderUpload: (files: FileList | File[]) => void;
  onClearData: () => void;
  heatmapRadius: number;
  setHeatmapRadius: (r: number) => void;
  
  // Dynamic lookup filters
  isDataLoaded: boolean;
  maps: string[];
  selectedMap: string;
  setSelectedMap: (map: string) => void;
  dates: string[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  matches: Array<{ match_id: string; date: string; human_count: number; bot_count: number }>;
  selectedMatchId: string;
  setSelectedMatchId: (id: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  showBots,
  setShowBots,
  showHumans,
  setShowHumans,
  heatmapMode,
  setHeatmapMode,
  onFileUpload,
  onFolderUpload,
  onClearData,
  heatmapRadius,
  setHeatmapRadius,
  isDataLoaded,
  maps,
  selectedMap,
  setSelectedMap,
  selectedDate,
  setSelectedDate,
  dates,
  matches,
  selectedMatchId,
  setSelectedMatchId,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const filtered = filesArray.filter(file => {
        const path = file.webkitRelativePath || file.name;
        if (path.includes("node_modules") || path.includes(".git")) {
          return false;
        }
        const lower = path.toLowerCase();
        return lower.endsWith(".parquet") || lower.endsWith(".nakama-0") || lower.endsWith(".zip");
      });

      if (filtered.length === 0) {
        alert("No valid telemetry files (.parquet, .nakama-0, .zip) found in the selected folder.");
        return;
      }

      if (filtered.length > 1000) {
        alert(`Selected folder contains ${filtered.length} telemetry files. Uploading the first 1000 files.`);
        onFolderUpload(filtered.slice(0, 1000));
      } else {
        onFolderUpload(filtered);
      }
    }
  };

  return (
    <div className="filter-bar" style={{ flexWrap: "wrap", height: "auto" }}>
      <div className="brand">
        SPECTRE <span>TRACE</span>
      </div>

      <div className="filters-group">
        {/* Upload File Widget */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".parquet,.nakama-0,.zip"
          multiple
          style={{ display: "none" }}
        />
        <button
          className="btn-toggle active"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600", borderColor: "#38bdf8", color: "#38bdf8" }}
          onClick={() => fileInputRef.current?.click()}
          title="Upload Telemetry Files / ZIP"
        >
          <Upload size={14} />
          Upload Files/ZIP
        </button>

        {/* Upload Folder Widget */}
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderChange}
          {...({
            webkitdirectory: "",
            directory: "",
          } as any)}
          multiple
          style={{ display: "none" }}
        />
        <button
          className="btn-toggle active"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600", borderColor: "#a855f7", color: "#a855f7" }}
          onClick={() => folderInputRef.current?.click()}
          title="Upload Telemetry Folder Structure"
        >
          <FolderOpen size={14} />
          Upload Folder
        </button>

        {isDataLoaded && (
          <button
            className="btn-toggle active"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600", borderColor: "#f43f5e", color: "#f43f5e" }}
            onClick={onClearData}
            title="Clear all uploaded data"
          >
            <Trash2 size={14} />
            Clear Data
          </button>
        )}
      </div>

      {isDataLoaded && (
        <div className="filters-group" style={{ borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "16px" }}>
          {/* Map Selector */}
          <select
            className="filter-select"
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
          >
            {maps.map((m) => (
              <option key={m} value={m}>
                {m === "AmbroseValley" ? "Ambrose Valley" : m === "GrandRift" ? "Grand Rift" : m === "Lockdown" ? "Lockdown" : m}
              </option>
            ))}
          </select>

          {/* Date Selector */}
          <select
            className="filter-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="">All Days</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Match Selector */}
          <select
            className="filter-select"
            style={{ minWidth: "250px" }}
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
          >
            <option value="">-- Select Match ({matches.length} matches) --</option>
            {matches.map((m) => (
              <option key={m.match_id} value={m.match_id}>
                {m.match_id.substring(0, 8)}... ({m.human_count} Humans, {m.bot_count} Bots)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filters-group">
        {/* Entity Toggles */}
        <button
          className={`btn-toggle ${showHumans ? "active" : ""}`}
          onClick={() => setShowHumans(!showHumans)}
        >
          Humans
        </button>
        <button
          className={`btn-toggle ${showBots ? "active" : ""}`}
          onClick={() => setShowBots(!showBots)}
        >
          Bots
        </button>

        {/* Heatmap overlay choices */}
        <div style={{ height: "24px", width: "1px", background: "rgba(255,255,255,0.12)", margin: "0 4px" }} />
        <button
          className={`btn-toggle ${heatmapMode === "traffic" ? "active-traffic" : ""}`}
          onClick={() => setHeatmapMode(heatmapMode === "traffic" ? null : "traffic")}
        >
          Traffic
        </button>
        <button
          className={`btn-toggle ${heatmapMode === "kills" ? "active-kills" : ""}`}
          onClick={() => setHeatmapMode(heatmapMode === "kills" ? null : "kills")}
        >
          Kills
        </button>
        <button
          className={`btn-toggle ${heatmapMode === "deaths" ? "active-deaths" : ""}`}
          onClick={() => setHeatmapMode(heatmapMode === "deaths" ? null : "deaths")}
        >
          Deaths
        </button>
        <button
          className={`btn-toggle ${heatmapMode === "loot" ? "active-loot" : ""}`}
          onClick={() => setHeatmapMode(heatmapMode === "loot" ? null : "loot")}
        >
          Loot
        </button>

        {heatmapMode && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "12px", borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "12px" }}>
            <span style={{ fontSize: "0.7rem", color: "#9ca3af", whiteSpace: "nowrap" }}>Radius: {heatmapRadius}px</span>
            <input
              type="range"
              min={5}
              max={40}
              value={heatmapRadius}
              onChange={(e) => setHeatmapRadius(Number(e.target.value))}
              style={{ width: "80px", cursor: "pointer", accentColor: "#38bdf8" }}
              title="Adjust heatmap point radius size"
            />
          </div>
        )}
      </div>
    </div>
  );
};


