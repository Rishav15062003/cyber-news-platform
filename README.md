# CyberPulse

CyberPulse is a local-first cybersecurity news intelligence platform that aggregates trusted cyber feeds, scores and clusters incidents, and presents actionable updates in a compact UI.

It includes:
- `backend` - Node.js/Express API for ingestion, enrichment, ranking, clustering, and personalization
- `web` - React/Vite dashboard for analysts and security teams
- `mobile` - React Native (Expo) app consuming the same backend APIs

## Key capabilities

- Multi-source ingestion from trusted cybersecurity feeds
- AI brief for each article (quick + technical summary modes)
- CVE extraction and enrichment (`/api/cves`)
- Incident clustering ("same event from N sources")
- Source trust + confidence scoring
- Search, filtering, sorting, and bookmarking
- Source health dashboard (up/down/fallback/error visibility)
- User profile controls:
  - topics
  - sectors
  - role
  - risk profile
  - alert policy
  - quiet hours
- SSE alerts stream (`/api/alerts/stream`) for critical and digest events
- Local persistence in `backend/data/store.json`

## Refresh behavior (important)

- Backend refreshes on a randomized cadence of **every 5-10 minutes**
- API now exposes:
  - `lastUpdatedAt`
  - `nextRefreshAt`
- Web UI displays:
  - `Last update`
  - `Next refresh in`

## Tech stack

- Backend: Node.js, Express, node-cron, rss-parser
- Web: React, Vite
- Mobile: React Native, Expo
- Storage: local JSON store (`backend/data/store.json`)

## Project structure

```text
cyber-news-platform/
  backend/
    src/
    data/store.json
  web/
    src/
  mobile/
    App.js
```

## Quick start (new user)

### 1) Clone

```bash
git clone <your-repo-url>
cd cyber-news-platform
```

### 2) Start backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

### 3) Start web app

Open a second terminal:

```bash
cd web
npm install
npm run dev
```

Web runs on `http://localhost:5173`.

If backend URL is different, create `web/.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

### 4) (Optional) Start mobile app

```bash
cd mobile
npm install
npx expo start
```

If testing on physical device, update `API_BASE_URL` in `mobile/App.js` to your machine LAN IP.

## API overview

- `GET /api/health`
- `GET /api/news`
- `GET /api/news/sources`
- `GET /api/news/sources/status`
- `PUT /api/news/sources/:sourceId`
- `GET /api/news/incidents`
- `GET /api/news/incidents/:clusterId`
- `GET /api/cves`
- `GET /api/alerts/stream`
- `GET /api/users/:userId/profile`
- `PUT /api/users/:userId/profile`
- `GET /api/users/:userId/bookmarks`
- `POST /api/users/:userId/bookmarks`
- `DELETE /api/users/:userId/bookmarks/:itemId`
- `GET /api/users/:userId/bookmarks/export?format=markdown|csv`
- `POST /api/users/:userId/digest`

## Local-first notes

This system is designed to run fully on your own machine:
- no dedicated server required
- no mandatory cloud infrastructure
- all app state persisted locally

Some sources may not expose valid RSS endpoints. Those can appear down until HTML scraping support is introduced.

## Troubleshooting

- **No news updates shown**
  - Confirm backend is running on `http://localhost:4000`
  - Check `GET /api/health` for `lastUpdatedAt` and `nextRefreshAt`
- **Some sources are down**
  - Use source dashboard to inspect status/fallback/error details
  - Disable unstable/non-RSS sources from the UI
- **Web not connecting**
  - Verify `VITE_API_BASE_URL` and restart web dev server

## Production hardening roadmap

- Replace local JSON store with PostgreSQL/MongoDB
- Introduce Redis + queue workers
- Add authentication and per-user persistence
- Add robust source-specific parsers/scrapers with retry/rate control
- Containerize services and add observability (metrics/logging/tracing)

## Changelog

### v1.0.0

- Initial public release of CyberPulse
- Local-first backend + web + mobile architecture
- Trusted-source aggregation, deduplication, ranking, and incident clustering
- AI brief modes (quick/technical) and CVE enrichment support
- User personalization, bookmarks, digest generation, and SSE alerts
- Source health dashboard and runtime source enable/disable controls
- News refresh cadence updated to randomized 5-10 minutes with next refresh visibility

## Release

- Current stable release: `v1.0.0`
- GitHub Releases: [https://github.com/Rishav15062003/cyber-news-platform/releases](https://github.com/Rishav15062003/cyber-news-platform/releases)
