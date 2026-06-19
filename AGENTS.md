# AGENTS.md

## Project

AniWRLD is a self-hosted anime media library built with React, Vite, Node.js, SQLite, Docker Compose, and an internal Jellyfin media engine.

## User Workflow Preference

When the user asks in Russian: `спланируй мой xx-минутный спринт для проекта`

Your task is to:

- prioritize one concrete task for exactly that sprint duration;
- make the task strict, specific, and executable in about 30 minutes unless the user requested another duration;
- describe the expected output clearly;
- add a short Habitica-ready task description with all useful setup/details.

## Development Rules

- Keep changes focused and small.
- Prefer existing patterns in `src/main.jsx`, `src/styles.css`, `server/index.js`, and `server/media.js`.
- Do not expose Jellyfin tokens or raw media-engine API details to the browser.
- Browser-facing media routes should go through `/api/media/*`.
- Use `rg` for searching.
- Use `npm run build` as the lightweight verification step.
- If the user asks for final deployment verification, run `docker-compose up -d --build`.
- Do not commit runtime metadata, local databases, media-engine cache/config, `.env`, `dist/`, or `node_modules/`.

## Important Paths

- `src/main.jsx` — main React app, player, library UI, modals.
- `src/styles.css` — global UI, themes, responsive layout, player styling.
- `src/lib/media.js` — browser media API client.
- `server/index.js` — HTTP routes, auth routes, media proxy routes.
- `server/media.js` — Jellyfin/media-engine adapter.
- `server/db.js` — SQLite initialization and settings helpers.
- `compose.yaml` — production stack with AniWRLD and internal Jellyfin.

## Runtime Notes

- The first registered user becomes admin.
- Runtime SQLite lives in `data/aniwrld.sqlite` by default.
- Docker Compose stores persistent runtime data in volumes.
- `docker-compose down -v` removes local stack metadata and should only be used when explicitly requested.

## Player Notes

- The app uses Plyr with HLS.js.
- Quality options are presented as Auto, 1080p, 720p, 480p, 360p, and 144p.
- Episode switching should keep the player usable and should not auto-skip endings.
- The next-episode prompt is intentionally manual.
