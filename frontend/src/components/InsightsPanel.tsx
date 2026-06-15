import React from "react";
import { Info, ShieldAlert, Award, Skull, Package } from "lucide-react";
import { MatchDetail } from "../utils/api";

interface InsightsPanelProps {
  matchDetail: MatchDetail | null;
  playbackTime: number;
  onSeekTo: (ms: number) => void;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ matchDetail, playbackTime, onSeekTo }) => {
  if (!matchDetail) {
    return (
      <div className="insights-sidebar">
        <div className="sidebar-header">
          <Info size={16} />
          Match Statistics
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: "0.85rem", padding: "20px" }}>
          Select a match to view live metrics & logs
        </div>
      </div>
    );
  }

  const humanCount = matchDetail.trajectories.filter(t => !t.is_bot).length;
  const botCount = matchDetail.trajectories.filter(t => t.is_bot).length;

  // Aggregate stats up to the current playback time
  const eventsFiltered = matchDetail.events.filter(e => e.ts <= playbackTime);
  const kills = eventsFiltered.filter(e => e.event === "Kill" || e.event === "BotKill").length;
  const deaths = eventsFiltered.filter(e => e.event === "Killed" || e.event === "BotKilled" || e.event === "KilledByStorm").length;
  const loot = eventsFiltered.filter(e => e.event === "Loot").length;
  const stormDeaths = eventsFiltered.filter(e => e.event === "KilledByStorm").length;

  const eventRowIcon = (ev: string) => {
    switch (ev) {
      case "Kill":
      case "BotKill":
        return <Award size={14} color="#38bdf8" />;
      case "Killed":
      case "BotKilled":
        return <Skull size={14} color="#f43f5e" />;
      case "KilledByStorm":
        return <ShieldAlert size={14} color="#a855f7" />;
      case "Loot":
        return <Package size={14} color="#fbbf24" />;
      default:
        return <Info size={14} color="#9ca3af" />;
    }
  };

  const getEventNameFormatted = (ev: string) => {
    if (ev === "BotKill") return "Killed Bot";
    if (ev === "BotKilled") return "Died to Bot";
    if (ev === "KilledByStorm") return "Died to Storm";
    return ev;
  };

  return (
    <div className="insights-sidebar">
      <div className="sidebar-header">
        <Info size={16} />
        Live View Statistics
      </div>

      <div className="sidebar-content">
        {/* Core Stats Overview */}
        <div>
          <h3 className="section-title">Participants</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Humans</div>
              <div className="stat-val cyan">{humanCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">AI Bots</div>
              <div className="stat-val rose">{botCount}</div>
            </div>
          </div>
        </div>

        {/* Combat Metrics */}
        <div>
          <h3 className="section-title">Match Performance</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Kills (Total)</div>
              <div className="stat-val cyan">{kills}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Loot picked</div>
              <div className="stat-val gold">{loot}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Deaths</div>
              <div className="stat-val rose">{deaths}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Storm Casualty</div>
              <div className="stat-val" style={{ color: "#a855f7" }}>{stormDeaths}</div>
            </div>
          </div>
        </div>

        {/* Real-time Event Log */}
        <div>
          <h3 className="section-title">Live Combat Logs</h3>
          <div className="event-list">
            {eventsFiltered.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#6b7280", fontSize: "0.75rem" }}>
                No events recorded yet. Press play to start.
              </div>
            ) : (
              [...eventsFiltered].reverse().map((e, index) => (
                <div
                  key={index}
                  className="event-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => onSeekTo(e.ts)}
                  title={`Warp timeline to ${Math.floor(e.ts / 1000)}s`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {eventRowIcon(e.event)}
                    <span style={{ fontWeight: 600, color: "#fff" }}>
                      {e.user_id.substring(0, 5)}
                    </span>
                    <span style={{ color: "#9ca3af" }}>{getEventNameFormatted(e.event)}</span>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#6b7280" }}>
                    {Math.floor(e.ts / 1000)}s
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
