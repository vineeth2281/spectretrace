# ARCHITECTURE.md - Player Journey Visualization Tool

## What was Built
We built a decoupled **microservice-based player journey visualization tool** for LILA BLACK:
1. **Backend Service (FastAPI + Polars)**: Parses 5 days of battle royale telemetry Parquet files, tracks matches and dates metadata, groups positions into player paths, decodes event labels, and maps coordinates.
2. **Frontend Service (React + Vite + TypeScript + Leaflet.js)**: Connects to the backend REST API, visualizes player journeys and combat events on top of custom-scaled map canvases, manages playback timeline states (play, pause, seeking, playback speed multiplier), and hosts a live-computed game statistics panel.

---

## Data Flow
```
Parquet Telemetry Files (player_data/)
              │
              ▼
    FastAPI Python Service
   (Polars groups paths & maps coords)
              │
       [JSON REST API]
              │
              ▼
   React + TypeScript Frontend
 (Leaflet.js Coordinate Rendering)
```

---

## Coordinate Mapping Approach

The primary challenge is converting 3D in-game world coordinates `(x, y, z)` onto a 2D minimap image layout of `1024x1024` pixels.
In-game systems use a Cartesian system where:
- `x` is the horizontal coordinate.
- `z` is the depth coordinate (used as 2D vertical coordinate).
- `y` represents world elevation/height (not mapped to 2D screen positions).

Because image layouts start at `(0, 0)` in the top-left (Y-down) while game coordinates scale Y-up, we apply an **affine transformation with a vertical coordinate flip**:

### Mathematical Mapping Formulas:
1. **Normalize to UV space (0 to 1 range)**:
   $$u = \frac{x - \text{origin\_x}}{\text{scale}}$$
   $$v = \frac{z - \text{origin\_z}}{\text{scale}}$$
2. **Translate to Screen Pixels (1024x1024)**:
   $$\text{pixel\_x} = u \times 1024$$
   $$\text{pixel\_y} = (1 - v) \times 1024 \quad \text{(Flipped vertical axis)}$$

### Configuration Coordinates Matrix:
| Map | Scale | Origin X | Origin Z |
| :--- | :--- | :--- | :--- |
| **AmbroseValley** | 900.0 | -370.0 | -473.0 |
| **GrandRift** | 581.0 | -290.0 | -290.0 |
| **Lockdown** | 1000.0 | -500.0 | -500.0 |

This math was calibrated using baseline check coordinates (e.g., world position `x = -301.45, z = -355.55` on AmbroseValley maps to pixel `x = 78, y = 890`), which renders precisely correct positions relative to landmark images.

---

## Assumptions Made
1. **Bot Detection**: Players with numeric string IDs (e.g., `1440`, `382`) are classified as Bots, while UUID string IDs are classified as Human players.
2. **Timestamp Normalization**: The `ts` column is stored as timestamps. By calculating the min timestamp `ts_min` for each match session and subtracting it from each row's timestamp, we normalized the progression timeline into milliseconds elapsed since match start.
3. **Storm Deaths**: Events of type `KilledByStorm` represent storm deaths and are rendered as purple lightning bolt markers.

---

## Major Tradeoffs

| Decision | Chose | Over | Reason |
| :--- | :--- | :--- | :--- |
| **Data Layer** | FastAPI + Polars Backend | DuckDB-Wasm in browser | Polars handles parsing and coordinate mapping fast on the backend. This keeps the React frontend lightweight, fast to boot, and free of DuckDB-Wasm wasm download overhead. |
| **Layout styling** | Vanilla CSS | Tailwind CSS | Conformed to style stack restrictions, creating a custom dark gamer aesthetic. |
| **Map Rendering** | Leaflet.js | Plain HTML5 Canvas | Leaflet.js gives interactive pan, zoom, scale-independent tooltips, and easy coordinate bounds mapping natively. |
| **State management** | React Context/State | Redux | React state is more than sufficient for the playback timeline, keeping the codebase clean and boilerplate-free. |

---

## Advanced Feature Implementations

### 1. Dynamic Zoom Scaling (CSS Variables + Event Listeners)
To prevent telemetry icons (Kills, Deaths, Loot) and directional arrows (`➤`) from becoming tiny when zooming in, we implemented a dynamic scaling system:
- The `MapCanvas` component listens to Leaflet's `zoomend` event.
- It calculates a scale multiplier: $\text{scale} = 1.25^{\text{zoom\_level}}$.
- This scale is injected as a CSS custom variable (`--map-zoom-scale`) on the map container.
- Child vectors scale their sizes (`width`, `height`, `font-size`, `margin`) relative to this property using CSS `calc()`.

### 2. Directional Movement Vectors
Directional movement chevrons are drawn dynamically:
- Calculates screen angles between coordinate steps using standard screen-space trigonometry: `Math.atan2(dy, dx)`.
- Overlays rotated SVG chevrons styled in high-contrast colors (Gold for Human players, Rose for Bots) pointing along the vector.

### 3. Log-Scrub Time Warping
- Live combat log rows in the `InsightsPanel` are interactive.
- Clicking any log entry fires a seek callback (`seekTo`) that warps the main timeline playback state directly to that event's timestamp.

### 4. Zero-State Startup & Reset
- The server wipes the telemetry workspace directory (`player_data`) on startup, guaranteeing the app boots to zero loaded matches.
- A **Clear Data** trash button sends a `POST` request to `/api/clear` to flush stored files and cache at runtime, resetting the client.
- The folder upload parsing filters out system directories (`node_modules`, `.git`) and caps batch loads at 1000 files to protect server performance.
