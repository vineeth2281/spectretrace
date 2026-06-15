import os
import io
import polars as pl
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.utils.coordinates import world_to_minimap, MAP_CONFIGS

app = FastAPI(title="LILA BLACK Player Journey API", description="Microservice serving player telemetry and metrics")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "player_data"))
DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

# In-memory cache for fast metadata lookup
# Structure: { match_id: { "map_id": str, "date": str, "files": [str], "human_count": int, "bot_count": int } }
MATCHES_CACHE = {}

def build_cache():
    print("Building matches metadata cache...")
    for day in DAYS:
        day_dir = os.path.join(DATA_DIR, day)
        if not os.path.exists(day_dir):
            continue
        for f in os.listdir(day_dir):
            if not f.endswith(".nakama-0") and "_" not in f:
                continue
            
            # Identify match_id and user_id from filename
            if "_" in f:
                user_id, match_part = f.split("_")
                match_id = match_part.split(".")[0]
            else:
                user_id = "unknown"
                match_id = f.split(".")[0]
            
            is_bot = user_id.isdigit()
            filepath = os.path.join(day_dir, f)
            
            if match_id not in MATCHES_CACHE:
                MATCHES_CACHE[match_id] = {
                    "match_id": match_id,
                    "date": day.replace("_", " "),
                    "map_id": None,
                    "files": [],
                    "human_count": 0,
                    "bot_count": 0,
                    "duration_ms": 0
                }
            
            MATCHES_CACHE[match_id]["files"].append(filepath)
            if is_bot:
                MATCHES_CACHE[match_id]["bot_count"] += 1
            else:
                MATCHES_CACHE[match_id]["human_count"] += 1

    # Calibrate map_id and duration from a subset of files in matches
    for match_id, info in MATCHES_CACHE.items():
        if info["files"]:
            try:
                # Read just the first file to get the map_id and estimate durations
                df = pl.read_parquet(info["files"][0])
                if len(df) > 0:
                    info["map_id"] = df["map_id"][0]
                    # Compute duration across all files (we will refine this dynamically if needed)
                    # But reading a single parquet schema/column is super fast
                    ts_col = df["ts"].cast(pl.Int64)
                    info["duration_ms"] = ts_col.max() - ts_col.min()
            except Exception as e:
                print(f"Error reading {info['files'][0]}: {e}")
                info["map_id"] = "AmbroseValley"
    print(f"Cache built with {len(MATCHES_CACHE)} matches.")

@app.on_event("startup")
async def startup_event():
    import shutil
    # Clear previous telemetry files on start to start with zero matches
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    os.makedirs(DATA_DIR, exist_ok=True)
    build_cache()

@app.get("/api/meta")
def get_metadata():
    """Returns available maps, dates, and match statistics."""
    maps = set()
    dates = set()
    for m in MATCHES_CACHE.values():
        if m["map_id"]:
            maps.add(m["map_id"])
        if m["date"]:
            dates.add(m["date"])
    return {
        "maps": sorted(list(maps)),
        "dates": sorted(list(dates)),
        "total_matches": len(MATCHES_CACHE)
    }

@app.get("/api/matches")
def list_matches(
    map_id: str = Query(None),
    date: str = Query(None),
    min_humans: int = Query(0)
):
    """Lists matches with summaries, filterable by map, date, and player type counts."""
    results = []
    for mid, info in MATCHES_CACHE.items():
        if map_id and info["map_id"] != map_id:
            continue
        if date and info["date"] != date:
            continue
        if info["human_count"] < min_humans:
            continue
        
        results.append({
            "match_id": info["match_id"],
            "map_id": info["map_id"],
            "date": info["date"],
            "human_count": info["human_count"],
            "bot_count": info["bot_count"],
            "duration_ms": int(info["duration_ms"])
        })
    return results

@app.get("/api/matches/{match_id}")
def get_match_details(match_id: str):
    """Loads all telemetry logs for a match, performs coordinate mapping and structures player trajectories and events."""
    if match_id not in MATCHES_CACHE:
        raise HTTPException(status_code=404, detail="Match not found")
    
    info = MATCHES_CACHE[match_id]
    dfs = []
    for filepath in info["files"]:
        try:
            df = pl.read_parquet(filepath)
            dfs.append(df)
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            
    if not dfs:
        raise HTTPException(status_code=500, detail="Could not read match data")
        
    # Combine all player tables for this match
    combined = pl.concat(dfs)
    
    # Cast ts to raw milliseconds representation (Int64)
    # The ts column has datetime type. Cast to pl.Int64 returns epoch microseconds or milliseconds depending on representation.
    # Let's inspect ts cast behavior: Polars datetime epoch cast gives microseconds. Dividing by 1000 gives milliseconds.
    combined = combined.with_columns([
        pl.col("ts").cast(pl.Int64).alias("ts_ms")
    ])
    
    # Calculate relative time offset from match start
    min_ts = combined["ts_ms"].min()
    combined = combined.with_columns([
        (pl.col("ts_ms") - min_ts).alias("match_time_ms")
    ])
    
    # Decode event type bytes to string
    events_decoded = [b.decode("utf-8") if isinstance(b, bytes) else str(b) for b in combined["event"].to_list()]
    combined = combined.with_columns([
        pl.Series("event_str", events_decoded)
    ])
    
    map_id = info["map_id"] or "AmbroseValley"
    
    # Group into player trajectories (movement path coordinates)
    trajectories = {}
    events = []
    
    # Process rows
    for row in combined.to_dicts():
        user_id = row["user_id"]
        is_bot = user_id.isdigit()
        
        # Check if coordinates are valid numbers
        if row["x"] is None or row["z"] is None:
            continue
            
        px, py = world_to_minimap(row["x"], row["z"], map_id)
        time_offset = row["match_time_ms"]
        event_type = row["event_str"]
        
        # Separate position events from action events
        if event_type in ["Position", "BotPosition"]:
            if user_id not in trajectories:
                trajectories[user_id] = {
                    "user_id": user_id,
                    "is_bot": is_bot,
                    "path": []
                }
            trajectories[user_id]["path"].append({
                "x": px,
                "y": py,
                "ts": time_offset
            })
        else:
            # Action event
            events.append({
                "user_id": user_id,
                "is_bot": is_bot,
                "event": event_type,
                "x": px,
                "y": py,
                "ts": time_offset,
                "world_x": row["x"],
                "world_z": row["z"],
                "y_elevation": row["y"]
            })
            
    # Sort paths and events by timestamp
    for t_data in trajectories.values():
        t_data["path"].sort(key=lambda item: item["ts"])
    events.sort(key=lambda item: item["ts"])
    
    # Summary stats
    total_duration = combined["match_time_ms"].max()
    
    return {
        "match_id": match_id,
        "map_id": map_id,
        "date": info["date"],
        "duration_ms": int(total_duration) if total_duration else 0,
        "trajectories": list(trajectories.values()),
        "events": events
    }

import zipfile

@app.post("/api/upload")
async def upload_parquet_files(files: list[UploadFile] = File(default=[])):
    """Receives uploaded Parquet/telemetry files or ZIP files, parses them, and returns combined trajectories + events."""
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        dfs = []
        for f in files:
            contents = await f.read()
            if f.filename.endswith(".zip"):
                with zipfile.ZipFile(io.BytesIO(contents)) as z:
                    for name in z.namelist():
                        if name.endswith("/") or "__MACOSX" in name:
                            continue
                        with z.open(name) as zf:
                            file_bytes = zf.read()
                            try:
                                df = pl.read_parquet(io.BytesIO(file_bytes))
                                if len(df) > 0:
                                    dfs.append(df)
                            except Exception as ex:
                                print(f"Error reading zip entry {name}: {ex}")
                                continue
            else:
                try:
                    df = pl.read_parquet(io.BytesIO(contents))
                    if len(df) > 0:
                        dfs.append(df)
                except Exception as ex:
                    print(f"Error reading file {f.filename}: {ex}")
                    continue

        if not dfs:
            raise HTTPException(status_code=400, detail="No valid parquet data found in uploaded files")

        # Combine all dataframes
        combined = pl.concat(dfs)
        
        if len(combined) == 0:
            raise HTTPException(status_code=400, detail="Uploaded files contain no rows")
            
        # Parse match metadata
        match_id = combined["match_id"][0]
        map_id = combined["map_id"][0]
        
        combined = combined.with_columns([
            pl.col("ts").cast(pl.Int64).alias("ts_ms")
        ])
        
        # Relative time offset
        min_ts = combined["ts_ms"].min()
        combined = combined.with_columns([
            (pl.col("ts_ms") - min_ts).alias("match_time_ms")
        ])
        
        # Decode events
        events_decoded = [b.decode("utf-8") if isinstance(b, bytes) else str(b) for b in combined["event"].to_list()]
        combined = combined.with_columns([
            pl.Series("event_str", events_decoded)
        ])
        
        trajectories = {}
        events = []
        
        for row in combined.to_dicts():
            user_id = row["user_id"]
            is_bot = user_id.isdigit()
            
            if row["x"] is None or row["z"] is None:
                continue
                
            px, py = world_to_minimap(row["x"], row["z"], map_id)
            time_offset = row["match_time_ms"]
            event_type = row["event_str"]
            
            if event_type in ["Position", "BotPosition"]:
                if user_id not in trajectories:
                    trajectories[user_id] = {
                        "user_id": user_id,
                        "is_bot": is_bot,
                        "path": []
                    }
                trajectories[user_id]["path"].append({
                    "x": px,
                    "y": py,
                    "ts": time_offset
                })
            else:
                events.append({
                    "user_id": user_id,
                    "is_bot": is_bot,
                    "event": event_type,
                    "x": px,
                    "y": py,
                    "ts": time_offset,
                    "world_x": row["x"],
                    "world_z": row["z"],
                    "y_elevation": row["y"]
                })
                
        for t_data in trajectories.values():
            t_data["path"].sort(key=lambda item: item["ts"])
        events.sort(key=lambda item: item["ts"])
        
        total_duration = combined["match_time_ms"].max()
        
        return {
            "match_id": match_id,
            "map_id": map_id,
            "date": "Uploaded Telemetry",
            "duration_ms": int(total_duration) if total_duration else 0,
            "trajectories": list(trajectories.values()),
            "events": events
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing uploaded data: {str(e)}")

import shutil

@app.post("/api/upload_folder")
async def upload_folder(files: list[UploadFile] = File(...)):
    """Receives files uploaded from a folder structure, clears previous DATA_DIR contents, saves them in their relative paths, and builds matches cache."""
    try:
        # Clear DATA_DIR first
        if os.path.exists(DATA_DIR):
            shutil.rmtree(DATA_DIR)
        os.makedirs(DATA_DIR, exist_ok=True)

        for file in files:
            # Clean up the filename relative path
            # Normalize to forward slashes
            rel_path = file.filename.replace("\\", "/")
            parts = rel_path.split("/")
            if not parts or not parts[-1]:
                continue
                
            # Align path to start at the day folder (e.g. February_10) to discard parent folder names
            day_index = -1
            for i, part in enumerate(parts):
                if part in DAYS:
                    day_index = i
                    break
            
            if day_index != -1:
                parts = parts[day_index:]
            elif parts[0] == "player_data":
                parts = parts[1:]
                
            # Reconstruct target path inside DATA_DIR
            target_path = os.path.join(DATA_DIR, *parts)
            
            # Ensure target directory exists
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            
            # Save the file
            contents = await file.read()
            with open(target_path, "wb") as f:
                f.write(contents)
                
        # Re-build MATCHES_CACHE dynamically based on new DATA_DIR contents
        MATCHES_CACHE.clear()
        build_cache()
        
        # Get metadata
        meta = get_metadata()
        
        return {
            "success": True,
            "meta": meta,
            "total_files_uploaded": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process folder upload: {str(e)}")


@app.post("/api/clear")
async def clear_uploaded_files():
    """Clears all telemetry files inside DATA_DIR and resets the MATCHES_CACHE."""
    try:
        import shutil
        if os.path.exists(DATA_DIR):
            shutil.rmtree(DATA_DIR)
        os.makedirs(DATA_DIR, exist_ok=True)
        MATCHES_CACHE.clear()
        return {"success": True, "message": "All uploaded files cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear uploaded files: {str(e)}")

