const API_BASE = "const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";";

export interface MatchSummary {
  match_id: string;
  map_id: string;
  date: string;
  human_count: number;
  bot_count: number;
  duration_ms: number;
}

export interface MatchMeta {
  maps: string[];
  dates: string[];
  total_matches: number;
}

export interface PositionPoint {
  x: number;
  y: number;
  ts: number;
}

export interface PlayerTrajectory {
  user_id: string;
  is_bot: boolean;
  path: PositionPoint[];
}

export interface MatchEvent {
  user_id: string;
  is_bot: boolean;
  event: string;
  x: number;
  y: number;
  ts: number;
  world_x: number;
  world_z: number;
  y_elevation: number;
}

export interface MatchDetail {
  match_id: string;
  map_id: string;
  date: string;
  duration_ms: number;
  trajectories: PlayerTrajectory[];
  events: MatchEvent[];
}

export async function fetchMetadata(): Promise<MatchMeta> {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error("Failed to fetch metadata");
  return res.json();
}

export async function fetchMatches(mapId?: string, date?: string): Promise<MatchSummary[]> {
  const params = new URLSearchParams();
  if (mapId) params.append("map_id", mapId);
  if (date) params.append("date", date);
  const res = await fetch(`${API_BASE}/matches?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

export async function fetchMatchDetail(matchId: string): Promise<MatchDetail> {
  const res = await fetch(`${API_BASE}/matches/${matchId}`);
  if (!res.ok) throw new Error("Failed to fetch match details");
  return res.json();
}

export async function uploadParquetFiles(files: FileList | File[]): Promise<MatchDetail> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to parse uploaded parquet files");
  }
  return res.json();
}

export interface FolderUploadResponse {
  success: boolean;
  meta: MatchMeta;
  total_files_uploaded: number;
}

export async function uploadFolder(files: FileList | File[]): Promise<FolderUploadResponse> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = file.webkitRelativePath || file.name;
    formData.append("files", file, filename);
  }
  const res = await fetch(`${API_BASE}/upload_folder`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to process folder upload");
  }
  return res.json();
}

export async function clearUploadedFiles(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/clear`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to clear uploaded files");
  }
  return res.json();
}


