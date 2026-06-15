# INSIGHTS.md - Telemetry Analytics & Level Design Insights

This document analyzes player journey and combat metrics compiled from the visualizer screenshots to outline actionable level design improvements.

---

## Insight 1: Pacing Loops vs. Tactical Navigation (AI Bots vs. Humans)

### 1. Observations in the Data
* **AI Bots** exhibit chaotic, circular pacing patterns. They loop repeatedly inside small, confined areas (like tents or single buildings) instead of traveling across the map.
* **Human Players** exhibit highly linear, purposeful, and long-range routing. They utilize bridges, roads, and open corridors to navigate from one loot zone to another.

### 2. Concrete Patterns
* In the bot-heavy match (**Image 1: 14 Bots**), the rose dashed trails are concentrated in tight, localized zig-zags (such as the camp on the left and the building on the right), with chevrons showing frequent 180-degree U-turns.
* In the human match (**Image 2: 1 Human**), the cyan trail starts in a southern housing area, crosses the bridge, and moves directly north along the main road checkpoint, traveling over half the map scale.

### 3. Actionable Items
* **Actionable Item**: Redesign the AI navigation mesh (NavMesh) pathing nodes to align with road networks and bridges, forcing bots to move between POIs (Points of Interest) rather than getting stuck pacing in local tents.
* **Metrics Affected**: 
  * *Player-Bot Encounter Rate* (increases, leading to more early-game action).
  * *Match Duration* (bots die faster as they migrate to hot zones).
* **Implementation**: Define linear patrol corridors for bots linking hot zones together.

### 4. Why Level Designers Care
If AI bots do not move realistically between POIs, human players will find matches boring and bots will feel like "pacing targets" rather than active combatants.

---

## Insight 2: Transition Bottlenecks (Loot POIs to Travel Corridors)

### 1. Observations in the Data
* **Looting** is highly concentrated inside building footprints, whereas **combat** occurs almost immediately after players exit these structures and step onto the roads.

### 2. Concrete Patterns
* In the human match (**Image 2**), all 13 loot events (**L**) are clustered inside the southern housing blocks. 
* As soon as the player leaves the houses and moves onto the asphalt road, they engage in heavy combat, resulting in 5 kills (**K**) distributed directly along the highway.

### 3. Actionable Items
* **Actionable Item**: Add road blockades, abandoned vehicles, or concrete barriers (half-cover) along the transition zones between looting structures and main roads. 
* **Metrics Affected**: 
  * *Early-Game Survival Rate* (reduces instant deaths for players leaving houses).
  * *Weapon Utilization* (enables short-to-mid range cover fights instead of open road long-range sniping).
* **Implementation**: Place cover assets within 15 meters of building exits leading to the road.

### 4. Why Level Designers Care
Designers need to manage the transition from "looting phase" to "rotation phase." If the path leaving a loot zone is an open highway without cover, players will get picked off easily, leading to high frustration rates.
