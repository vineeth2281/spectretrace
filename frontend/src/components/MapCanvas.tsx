import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MatchDetail } from "../utils/api";

// Fix Leaflet default icon URL resolution issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapCanvasProps {
  matchDetail: MatchDetail | null;
  playbackTime: number;
  isPlaying: boolean;
  showBots: boolean;
  showHumans: boolean;
  heatmapMode: "kills" | "deaths" | "traffic" | "loot" | null;
  selectedMap: string;
  heatmapRadius: number;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  matchDetail,
  playbackTime,
  isPlaying,
  showBots,
  showHumans,
  heatmapMode,
  selectedMap,
  heatmapRadius,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathLayersRef = useRef<L.Polyline[]>([]);
  const markerLayersRef = useRef<L.CircleMarker[]>([]);
  const eventMarkerLayersRef = useRef<L.Marker[]>([]);
  const heatmapLayerRef = useRef<L.Layer | null>(null);
  const bounds = L.latLngBounds([0, 0], [1024, 1024]);

  const mapImageSrc = () => {
    // Relative paths to the public directory files
    if (selectedMap === "GrandRift") {
      return "/minimaps/GrandRift_Minimap.png";
    }
    if (selectedMap === "Lockdown") {
      return "/minimaps/Lockdown_Minimap.jpg";
    }
    return "/minimaps/AmbroseValley_Minimap.png";
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy old map instance if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Set up Leaflet Map using Simple CRS (Cartesian pixel coordinate system)
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 3,
      maxBounds: bounds.pad(0.1),
      zoomControl: true,
      attributionControl: false,
    });

    // Fit bounds of 1024x1024 static image layout
    map.fitBounds(bounds);
    mapRef.current = map;

    // Load static image overlay representing the minimap
    const imageOverlay = L.imageOverlay(mapImageSrc(), bounds);
    imageOverlay.addTo(map);

    const updateZoomScale = () => {
      const zoom = map.getZoom();
      const scale = Math.pow(1.25, zoom);
      mapContainerRef.current?.style.setProperty("--map-zoom-scale", `${scale}`);
    };

    map.on("zoomend", updateZoomScale);
    updateZoomScale();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedMap]);

  // Clean overlays on updates
  const clearOverlays = () => {
    if (!mapRef.current) return;
    pathLayersRef.current.forEach((layer) => layer.remove());
    pathLayersRef.current = [];
    markerLayersRef.current.forEach((layer) => layer.remove());
    markerLayersRef.current = [];
    eventMarkerLayersRef.current.forEach((layer) => layer.remove());
    eventMarkerLayersRef.current = [];
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.remove();
      heatmapLayerRef.current = null;
    }
  };

  // Render player paths, current markers, events, and heatmaps
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clearOverlays();

    if (!matchDetail) return;

    // 1. RENDER PLAYER TRAJECTORIES (PATHS AND HEAD MARKERS)
    matchDetail.trajectories.forEach((traj) => {
      const isBot = traj.is_bot;
      if (isBot && !showBots) return;
      if (!isBot && !showHumans) return;

      if (traj.path.length === 0) return;

      // Extract points visited up to the current time offset
      const visitedPoints = traj.path.filter((pt) => pt.ts <= playbackTime);

      // Determine points to draw for the path trail: gradual if playing, full if paused/idle
      const pointsToDraw = isPlaying ? visitedPoints : traj.path;

      if (pointsToDraw.length > 0) {
        const latlngs = pointsToDraw.map((pt) => L.latLng(1024 - pt.y, pt.x)); // Y-flip offset correction
        const pathLine = L.polyline(latlngs, {
          color: isBot ? "#f43f5e" : "#0ea5e9", // Rose for Bot paths, Cyan for Humans
          weight: isBot ? 1.5 : 3,
          dashArray: isBot ? "4, 6" : undefined,
          opacity: 0.65,
        }).addTo(map);

        // Path Highlight on Hover
        pathLine.on("mouseover", () => {
          pathLine.setStyle({ opacity: 1.0, weight: isBot ? 3.0 : 6.0 });
          pathLayersRef.current.forEach((layer) => {
            if (layer !== pathLine) {
              layer.setStyle({ opacity: 0.12 });
            }
          });
        });

        pathLine.on("mouseout", () => {
          pathLayersRef.current.forEach((layer) => {
            const isLayerBot = layer.options.dashArray !== undefined;
            layer.setStyle({
              opacity: 0.65,
              weight: isLayerBot ? 1.5 : 3.0,
            });
          });
        });

        pathLayersRef.current.push(pathLine);

        // Directional Flow Arrows at regular intervals along trajectory
        const interval = 12;
        for (let i = interval; i < pointsToDraw.length; i += interval) {
          const p1 = pointsToDraw[i - 4];
          const p2 = pointsToDraw[i];
          if (!p1 || !p2) continue;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Standard screen-space clockwise rotation

          const arrowIcon = L.divIcon({
            html: `<div style="transform: rotate(${angle}deg); color: ${isBot ? '#f43f5e' : '#fbbf24'}; font-size: calc(13px * var(--map-zoom-scale, 1)); font-weight: bold; pointer-events: none; text-shadow: 0 0 2px #000; line-height: 1; display: flex; align-items: center; justify-content: center;">➤</div>`,
            className: "path-arrow-icon",
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });

          const arrowMarker = L.marker(L.latLng(1024 - p2.y, p2.x), { icon: arrowIcon }).addTo(map);
          markerLayersRef.current.push(arrowMarker as any);
        }
      }

      const currentPoint = visitedPoints.length > 0 ? visitedPoints[visitedPoints.length - 1] : traj.path[0];
      if (!currentPoint) return;

      // Draw glowing dot representing current player position head
      const headMarker = L.circleMarker(L.latLng(1024 - currentPoint.y, currentPoint.x), {
        radius: isBot ? 4 : 6,
        color: isBot ? "#f43f5e" : "#38bdf8",
        fillColor: isBot ? "#fda4af" : "#bae6fd",
        fillOpacity: 0.9,
        weight: 1,
      }).addTo(map);

      // Tooltip displaying info
      headMarker.bindTooltip(
        `<div>
          <strong>${isBot ? "Bot ID:" : "Human ID:"}</strong> ${traj.user_id.substring(0, 8)}...<br/>
          <strong>Time elapsed:</strong> ${Math.floor(currentPoint.ts / 1000)}s
        </div>`,
        { className: "custom-tooltip" }
      );
      markerLayersRef.current.push(headMarker);
    });

    // 2. RENDER ACTION EVENTS (KILLS, DEATHS, LOOT, STORM CASUALTIES)
    const activeEvents = matchDetail.events.filter((e) => e.ts <= playbackTime);
    activeEvents.forEach((ev) => {
      if (ev.is_bot && !showBots) return;
      if (!ev.is_bot && !showHumans) return;

      let iconHtml = "";
      const isLoot = ev.event === "Loot";
      
      if (ev.event === "Kill" || ev.event === "BotKill") {
        iconHtml = `<div style="background:#0ea5e9; border:calc(2px * var(--map-zoom-scale, 1)) solid #fff; border-radius:50%; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:calc(10px * var(--map-zoom-scale, 1)); font-weight:bold; box-shadow:0 0 6px rgba(0,0,0,0.5)">K</div>`;
      } else if (ev.event === "Killed" || ev.event === "BotKilled") {
        iconHtml = `<div style="background:#f43f5e; border:calc(2px * var(--map-zoom-scale, 1)) solid #fff; border-radius:50%; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:calc(10px * var(--map-zoom-scale, 1)); font-weight:bold; box-shadow:0 0 6px rgba(0,0,0,0.5)">D</div>`;
      } else if (ev.event === "KilledByStorm") {
        iconHtml = `<div style="background:#a855f7; border:calc(2px * var(--map-zoom-scale, 1)) solid #fff; border-radius:50%; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:calc(10px * var(--map-zoom-scale, 1)); font-weight:bold; box-shadow:0 0 6px rgba(0,0,0,0.5)">⚡</div>`;
      } else if (ev.event === "Loot") {
        iconHtml = `<div style="background:#eab308; border:calc(1.5px * var(--map-zoom-scale, 1)) solid #fff; border-radius:50%; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:calc(8px * var(--map-zoom-scale, 1)); font-weight:bold; box-shadow:0 0 6px rgba(0,0,0,0.5)">L</div>`;
      }

      const customIcon = L.divIcon({
        html: iconHtml,
        className: isLoot ? "event-loot-icon" : "event-combat-icon",
        iconSize: isLoot ? [12, 12] : [16, 16],
        iconAnchor: isLoot ? [6, 6] : [8, 8],
      });

      const marker = L.marker(L.latLng(1024 - ev.y, ev.x), { icon: customIcon }).addTo(map);
      marker.bindTooltip(
        `<div>
          <strong>User ID:</strong> ${ev.user_id.substring(0, 8)}...<br/>
          <strong>Event:</strong> ${ev.event}<br/>
          <strong>World pos:</strong> x: ${ev.world_x.toFixed(1)}, z: ${ev.world_z.toFixed(1)}<br/>
          <strong>Elevation (Y):</strong> ${ev.y_elevation.toFixed(1)}m
        </div>`,
        { className: "custom-tooltip" }
      );
      eventMarkerLayersRef.current.push(marker);
    });

    // 3. RENDER HEATMAP OVERLAY LAYERS
    if (heatmapMode) {
      let dataPoints: L.Circle[] = [];
      let pointsToMap: Array<{ x: number; y: number; weight: number }> = [];

      if (heatmapMode === "traffic") {
        // Collect all movement points across all active trajectories
        matchDetail.trajectories.forEach((t) => {
          if (t.is_bot && !showBots) return;
          if (!t.is_bot && !showHumans) return;
          t.path.forEach((pt) => {
            if (pt.ts <= playbackTime) {
              pointsToMap.push({ x: pt.x, y: pt.y, weight: 1 });
            }
          });
        });
      } else if (heatmapMode === "kills") {
        matchDetail.events.forEach((ev) => {
          if (ev.ts <= playbackTime && (ev.event === "Kill" || ev.event === "BotKill")) {
            pointsToMap.push({ x: ev.x, y: ev.y, weight: 5 });
          }
        });
      } else if (heatmapMode === "deaths") {
        matchDetail.events.forEach((ev) => {
          if (ev.ts <= playbackTime && (ev.event === "Killed" || ev.event === "BotKilled" || ev.event === "KilledByStorm")) {
            pointsToMap.push({ x: ev.x, y: ev.y, weight: 5 });
          }
        });
      } else if (heatmapMode === "loot") {
        matchDetail.events.forEach((ev) => {
          if (ev.ts <= playbackTime && ev.event === "Loot") {
            pointsToMap.push({ x: ev.x, y: ev.y, weight: 3 });
          }
        });
      }

      // Draw custom circle heatmap layers with radial blur effect
      const heatmapGroup = L.layerGroup();
      pointsToMap.forEach((pt) => {
        let fillColor = "#a855f7"; // purple for traffic
        let cssClass = "heatmap-traffic";
        if (heatmapMode === "kills") {
          fillColor = "#0ea5e9"; // blue for kills
          cssClass = "heatmap-kills";
        } else if (heatmapMode === "deaths") {
          fillColor = "#f43f5e"; // rose for deaths
          cssClass = "heatmap-deaths";
        } else if (heatmapMode === "loot") {
          fillColor = "#eab308"; // gold for loot
          cssClass = "heatmap-loot";
        }

        const marker = L.circle(L.latLng(1024 - pt.y, pt.x), {
          radius: pt.weight * heatmapRadius,
          fillColor: fillColor,
          color: "transparent",
          fillOpacity: 0.18,
          className: cssClass,
        }).addTo(heatmapGroup);
        dataPoints.push(marker);
      });

      heatmapGroup.addTo(map);
      heatmapLayerRef.current = heatmapGroup;
    }
  }, [matchDetail, playbackTime, showBots, showHumans, heatmapMode]);

  return (
    <div className="map-viewport" style={{ minHeight: "500px", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", minHeight: "500px" }} />
      
      {/* Legend element on top of minimap view */}
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-line" style={{ background: "#0ea5e9" }} />
          <span>Human Player Journey</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: "#f43f5e", borderStyle: "dashed", height: "1px" }} />
          <span>AI Bot Trail</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#0ea5e9" }} />
          <span>K - Combat Kill Marker</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#f43f5e" }} />
          <span>D - Combat Death Marker</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#a855f7" }} />
          <span>⚡ - Storm Damage Death</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#eab308" }} />
          <span>L - Loot Pickup Event</span>
        </div>
      </div>
    </div>
  );
};
export default MapCanvas;

