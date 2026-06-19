import { db } from "./db.js";

const SHIKIMORI = "shikimori";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
const BASE_URL = "https://shikimori.one";

function cleanTitle(value = "") {
  return String(value)
    .replace(/\[[^\]]+\]|\([^)]+\)/g, " ")
    .replace(/\b(1080p|720p|480p|x264|x265|h\.?264|h\.?265|hevc|web[- ]?dl|webrip|bdrip|bluray|aac|flac|rus|sub|dub)\b/gi, " ")
    .replace(/\b(s\d{1,2}|season\s*\d{1,2}|сезон\s*\d{1,2}|ep?\s*\d{1,3}|серия\s*\d{1,3})\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheGet(provider, key) {
  const row = db.prepare("SELECT payload, updated_at AS updatedAt FROM metadata_cache WHERE provider = ? AND lookup_key = ?").get(provider, key);
  if (!row || Date.now() - row.updatedAt > CACHE_TTL) return null;
  try { return JSON.parse(row.payload); }
  catch { return null; }
}

function cacheSet(provider, key, payload) {
  db.prepare(`
    INSERT INTO metadata_cache (provider, lookup_key, payload, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider, lookup_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(provider, key, JSON.stringify(payload), Date.now());
}

function normalizeShikimori(entry) {
  if (!entry) return null;
  const image = entry.image?.original || entry.image?.preview || entry.image?.x96 || "";
  return {
    provider: SHIKIMORI,
    providerId: entry.id,
    russianTitle: entry.russian || "",
    englishTitle: entry.name || "",
    originalTitle: entry.name || "",
    score: entry.score ? Number(entry.score) : null,
    status: entry.status || "",
    kind: entry.kind || "",
    episodes: entry.episodes || null,
    episodesAired: entry.episodes_aired || null,
    airedOn: entry.aired_on || "",
    releasedOn: entry.released_on || "",
    poster: image ? `${BASE_URL}${image}` : "",
    url: entry.url ? `${BASE_URL}${entry.url}` : "",
  };
}

async function searchShikimori(title) {
  const key = cleanTitle(title).toLowerCase();
  if (!key || key.length < 2) return null;
  const cached = cacheGet(SHIKIMORI, key);
  if (cached) return cached;

  try {
    const url = new URL("/api/animes", BASE_URL);
    url.searchParams.set("search", key);
    url.searchParams.set("limit", "1");
    url.searchParams.set("order", "popularity");
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "AniWRLD metadata resolver",
      },
    });
    if (!response.ok) return null;
    const [entry] = await response.json();
    const metadata = normalizeShikimori(entry);
    if (metadata) cacheSet(SHIKIMORI, key, metadata);
    return metadata;
  } catch {
    return null;
  }
}

function applyMetadata(item, metadata) {
  if (!metadata) return item;
  return {
    ...item,
    title: item.title || metadata.russianTitle || metadata.englishTitle,
    originalTitle: item.originalTitle || metadata.originalTitle,
    rating: item.rating || metadata.score,
    desc: item.desc === "Описание пока не добавлено." ? "Описание будет подтянуто после расширенной индексации." : item.desc,
    metadata,
  };
}

export async function enrichItem(item) {
  const lookup = item.seriesTitle || item.title;
  return applyMetadata(item, await searchShikimori(lookup));
}

export async function enrichItems(items) {
  const enriched = [];
  for (const item of items) {
    enriched.push(await enrichItem(item));
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  return enriched;
}
