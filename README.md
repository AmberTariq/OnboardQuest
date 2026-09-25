# OnboardQuest 🎮

> **Gamified codebase architecture mentor.**  
> Learn your codebase, earn XP, unlock badges — one quest at a time.

---

## Aesthetic

Friendly retro 8-bit pixel OS — warm arcade blues, soft cream window backgrounds,  
vibrant mint HP bars, pixel-yellow XP coins. Crisp blocky pixel borders.  
No dark cyberpunk gradients.

## Stack

| Layer    | Tech                                  |
|----------|---------------------------------------|
| Backend  | Node.js · Express · dotenv · CORS     |
| Frontend | React 18 · Vite 5 · Tailwind CSS 3    |
| Fonts    | Press Start 2P · VT323 · Courier Prime|

## Project Structure

```
OnboardQuest/
├── backend/
│   ├── src/
│   │   ├── index.js          ← Express server entry
│   │   └── routes/
│   │       ├── quests.js     ← /api/quests
│   │       └── players.js    ← /api/players
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── main.jsx          ← React entry
│   │   ├── App.jsx           ← Shell: HUD · Sidebar · Router
│   │   ├── pages/
│   │   │   ├── QuestBoard.jsx
│   │   │   ├── LevelMap.jsx
│   │   │   └── PlayerProfile.jsx
│   │   └── styles/
│   │       └── global.css    ← 🎨 Retro pixel OS theme
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── package.json              ← Root scripts (concurrent dev)
└── README.md
```

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both servers concurrently
npm run dev
#   API  → http://localhost:3001
#   UI   → http://localhost:5173
```

## API Endpoints

| Method | Path                        | Description          |
|--------|-----------------------------|----------------------|
| GET    | /api/health                 | Server health check  |
| GET    | /api/quests                 | List all quests      |
| GET    | /api/quests/:id             | Quest detail         |
| POST   | /api/quests/:id/complete    | Mark quest complete  |
| GET    | /api/players/:id            | Player profile       |
| PATCH  | /api/players/:id/xp         | Award XP             |

## Design Tokens (CSS custom properties)

| Token              | Value      | Usage                        |
|--------------------|------------|------------------------------|
| `--col-sky`        | `#d6e8f5`  | World / page background      |
| `--col-blue`       | `#1a6fbf`  | Title bars, primary borders  |
| `--col-navy`       | `#0d3d6b`  | Pixel shadow edges           |
| `--col-cream`      | `#f5f0e8`  | Window interior fills        |
| `--col-mint`       | `#4ecb8c`  | HP bars, success states      |
| `--col-yellow`     | `#f5d000`  | XP coins, star accents       |

## CSS Component Classes

| Class                | Description                           |
|----------------------|---------------------------------------|
| `.pixel-window`      | Retro OS window frame                 |
| `.pixel-titlebar`    | Blue title bar with `.EXE` label      |
| `.pixel-btn`         | Raised pixel button (+ variants)      |
| `.pixel-badge`       | Small tag badge (difficulty / XP)     |
| `.pixel-progress`    | Stepped XP / HP bar                   |
| `.quest-card`        | Hoverable quest tile                  |
| `.pixel-hud`         | Player stat strip                     |
| `.app-shell`         | Full-screen sidebar + main grid       |
| `.loading-screen`    | Checker-board loading screen          |
