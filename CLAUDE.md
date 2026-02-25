# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

皮皮狗贪吃蛇 (Puppy Snake) - A browser-based snake game with smooth non-grid movement, mobile gyroscope controls, and pixel-perfect sprite rendering.

## Development Commands

This is a static HTML/CSS/JS project with no build step:

```bash
# Local development - serve with any static server
python3 -m http.server 8080
# or
npx serve .

# Deploy to Cloudflare Workers
npx wrangler deploy
```

## Architecture

### Module Organization

| Module | File | Responsibility |
|--------|------|----------------|
| Game Loop | `js/game.js` | Main entry, state machine (menu/playing/gameover), camera follow, rendering order |
| Assets | `js/assets.js` | SpriteSheet loading, hardcoded sprite coordinates (slices) |
| Player | `js/player.js` | Snake movement, path history recording, growth scaling, body collision |
| Map | `js/map.js` | Tile-based world (150px tiles), pixel-perfect collision detection |
| Props | `js/props.js` | Items/bugs spawning, bug AI chasing behavior, consume effects |
| Input | `js/input.js` | Keyboard, mouse, virtual joystick, gravity/gyroscope controls |

### Critical Technical Details

**Smooth Movement System (not grid-based):**
- Player records position history every 2px (`recordDistance`)
- Body segments rendered by indexing into `pathHistory` with `segmentSpacing` gaps
- Spacing scales with body size: `segmentSpacing = baseSegmentSpacing * growthScale`

**Collision Detection Hierarchy:**
1. `isLethal()` - Instant death: boundaries, rocks, red bugs
2. `isWall()` - Blocks movement: trees, mushroom houses, flower beds
3. `isWater()` - Bounce back with score penalty

**Difficulty Scaling (medium/hard only):**
- Every 500 points increases tier
- Buff spawn rate decreases 5% per tier (min 10%)
- Bug speed increases 20% per tier
- Chase speed increases 30px per tier

**Mobile Adaptations:**
- `viewScale = 0.75` on mobile for wider field of view
- Virtual joystick appears on touch start (non-button areas)
- Gravity mode requires DeviceOrientation permission (iOS)
- Calibration: 300ms wait before sampling baseline

**Input Priority:**
1. Gravity mode (if enabled) - exclusive when active
2. Virtual joystick (if active)
3. Keyboard (if mouse inactive)
4. Mouse (last used)

### Asset Pipeline

Sprite coordinates are hardcoded in `js/assets.js` (not calculated at runtime):
- `assets.slices.character` - Dog head (4 directions), body, tail
- `assets.slices.props` - Bones, bugs (animated frames), candy, bread, poop
- `assets.slices.map` - Grass, water, dirt, bridges, fences
- `assets.slices.decor` - Trees, flowers, rocks, mushroom houses

Python helper scripts in root:
- `process_images.py` - Removes background color from PNGs (uses top-left pixel as bg)
- `process_ai_images.py` - Additional image processing for AI-generated assets

### Game State Flow

```
Loading -> Menu (difficulty select) -> Playing -> Game Over -> Menu
```

Boost (space/🚀 button): 3 charges, 5s duration, 2x speed
Shield (E/🛡️ button): 2 charges, 5s duration, immunity to debuffs

### Key Configuration Values

```javascript
// Map tile size
MapManager.tileSize = 150

// World bounds
MapManager(width=8000, height=6000)

// Player base stats
Player.speed = 200 // px/sec
Player.baseRadius = 20
Player.boostDuration = 5000 // ms
Player.shieldDuration = 5000 // ms

// Difficulty presets
DIFFICULTY.easy   = { buffChance: 0.45, maxProps: 100, chaseSpeed: 60 }
DIFFICULTY.medium = { buffChance: 0.25, maxProps: 80,  chaseSpeed: 120 }
DIFFICULTY.hard   = { buffChance: 0.22, maxProps: 60,  chaseSpeed: 180 }
```

### Deployment

- Uses Cloudflare Workers (`wrangler.json`)
- Static assets served from root directory
- Main entry: `index.html`
