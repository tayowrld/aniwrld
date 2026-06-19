# AniWRLD

AniWRLD is a self-hosted anime media library with a polished React interface, Jellyfin-powered media indexing, private server-side streaming, watch progress, favorites, themes, and a custom Plyr-based video player.

## Features

- Private owner-managed anime library.
- React + Vite frontend with responsive library, details modal, favorites, watched collection, and resume cards.
- Custom Plyr video player with HLS playback, selectable quality profiles, volume, subtitles, PiP, fullscreen, episode sidebar, and next-episode prompt.
- Server-side Jellyfin integration: tokens and media engine API are never exposed to the browser.
- Russia-friendly anime metadata enrichment through Shikimori with local SQLite caching.
- Watch progress reporting and resume support.
- Favorite persistence through Jellyfin plus browser cookie fallback.
- Theme presets inspired by AniWRLD, Catppuccin, Rosé Pine, and Everforest.
- Docker Compose deployment with AniWRLD and an internal Jellyfin container.
- SQLite-backed auth and settings with HttpOnly sessions.

## Quick Start

Requirements:

- Docker and Docker Compose
- A local anime folder available on the host machine

Create a local environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANIWRLD_MEDIA_PATH=/absolute/path/to/anime
ANIWRLD_PORT=8787
```

Start the stack:

```bash
docker-compose up -d --build
```

Open:

```text
http://localhost:8787
```

On first launch, create the owner account. The first registered user becomes the administrator.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Run the production server locally:

```bash
npm start
```

For native local development, AniWRLD expects an available media engine. You can point it to one with:

```env
ANIWRLD_MEDIA_ENGINE_URL=http://127.0.0.1:8096
```

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ANIWRLD_MEDIA_PATH` | Docker | none | Absolute host path mounted into the media engine and AniWRLD. |
| `ANIWRLD_PORT` | No | `8787` | Host port exposed by Docker Compose. |
| `ANIWRLD_DB_PATH` | No | `data/aniwrld.sqlite` | SQLite database path. Docker sets this to `/app/data/aniwrld.sqlite`. |
| `ANIWRLD_MEDIA_ENGINE_URL` | No | `http://127.0.0.1:8096` | Internal Jellyfin URL. Docker sets this to `http://media-engine:8096`. |
| `ANIWRLD_LIBRARY_PATH` | No | none | Deployment-side library path. Docker sets this to `/media`. |

## Project Structure

```text
.
├── server/          # Auth, SQLite, settings, media proxy, production server
├── src/             # React frontend
├── src/lib/         # Browser API clients
├── public/          # Static visual assets
├── scripts/         # Local dev helpers
├── compose.yaml     # AniWRLD + internal Jellyfin stack
├── Dockerfile       # Production image
└── vite.config.js   # Vite config
```

## Security Model

- The Jellyfin/media-engine token is stored server-side only.
- The browser talks only to AniWRLD API routes.
- Images, direct streams, subtitles, and HLS playlists are proxied through AniWRLD.
- Sessions are stored in SQLite and sent as HttpOnly cookies.
- Registration is disabled by default after the first administrator is created.
- Runtime database and media metadata are ignored by Git.

## Media Engine

Docker Compose starts an internal Jellyfin container named `media-engine`. It is not published to the host; AniWRLD talks to it through the private Compose network.

AniWRLD configures the media engine during owner setup, indexes the mounted media folder, then uses it for:

- library discovery;
- metadata and artwork;
- resume/watched state;
- favorites;
- playback information;
- direct stream, HLS, and subtitle proxying.

## Metadata

AniWRLD does not rely on TMDB as a critical anime metadata source. Runtime metadata is enriched server-side through Shikimori and cached in SQLite for 30 days.

The metadata resolver:

- cleans release/folder names before lookup;
- queries Shikimori as the primary anime metadata provider;
- stores normalized provider data in `metadata_cache`;
- keeps Jellyfin as the playback/index engine, not the only metadata authority.

## Player

The player uses Plyr with HLS.js and supports:

- Auto, 1080p, 720p, 480p, 360p, and 144p quality options;
- subtitles when provided by the media engine;
- picture-in-picture;
- fullscreen;
- episode sidebar;
- manual next-episode button;
- next-episode prompt near the end of playback.

AniWRLD does not auto-skip endings or automatically advance episodes.

## Git Hygiene

The repository intentionally ignores:

- `node_modules/`
- `dist/`
- `data/`
- `.env`
- SQLite/WAL files
- local editor and assistant state

Use `.env.example` as the only committed environment template.
