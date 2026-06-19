import { db } from "./db.js";

const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
const JIKAN = "jikan";
const SHIKIMORI = "shikimori";
const JIKAN_BASE_URL = "https://api.jikan.moe";
const SHIKIMORI_BASE_URL = process.env.ANIWRLD_SHIKIMORI_URL || "https://shikimori.one";
const MISSING_IMAGE = "/assets/globals/missing_";

function cleanTitle(value = "") {
  return String(value)
    .replace(/\[[^\]]+\]|\([^)]+\)/g, " ")
    .replace(/\b(1080p|720p|480p|x264|x265|h\.?264|h\.?265|hevc|web[- ]?dl|webrip|bdrip|bluray|aac|flac|rus|sub|dub)\b/gi, " ")
    .replace(/\b(s\d{1,2}|season\s*\d{1,2}|сезон\s*\d{1,2}|ep?\s*\d{1,3}|серия\s*\d{1,3})\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchVariants(title) {
  const clean = cleanTitle(title);
  const variants = [
    clean,
    clean.replace(/\bseason\s*\d+\b/gi, " "),
    clean.replace(/\b(s\d{1,2}e\d{1,3}|s\d{1,2})\b/gi, " "),
    clean.replace(/[!！]+/g, " "),
  ].map(cleanTitle).filter(Boolean);
  return [...new Set(variants)];
}

function comparable(value = "") {
  return cleanTitle(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(query, entry) {
  const needle = comparable(query);
  const names = [entry.name, entry.russian, ...(entry.english || []), ...(entry.synonyms || [])]
    .filter(Boolean)
    .map(comparable);
  let best = 0;
  for (const name of names) {
    if (!needle || !name) continue;
    if (needle === name) best = Math.max(best, 1);
    if (needle.includes(name) || name.includes(needle)) {
      best = Math.max(best, Math.min(needle.length, name.length) / Math.max(needle.length, name.length));
    }
    const needleTokens = new Set(needle.split(" ").filter((token) => token.length > 1));
    const nameTokens = new Set(name.split(" ").filter((token) => token.length > 1));
    const overlap = [...needleTokens].filter((token) => nameTokens.has(token)).length;
    if (needleTokens.size && nameTokens.size) best = Math.max(best, overlap / Math.max(needleTokens.size, nameTokens.size));
  }
  return best;
}

function bestCandidate(query, entries) {
  return entries
    .map((entry) => ({ entry, score: titleScore(query, entry) }))
    .sort((a, b) => b.score - a.score || Number(b.entry.score || 0) - Number(a.entry.score || 0))[0];
}

function providerName() {
  const value = String(process.env.ANIWRLD_METADATA_PROVIDER || JIKAN).toLowerCase();
  return value === SHIKIMORI ? SHIKIMORI : JIKAN;
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
  const screenshot = entry.screenshots?.[0]?.original || entry.screenshots?.[0]?.preview || "";
  const poster = image && !image.startsWith(MISSING_IMAGE) ? `${SHIKIMORI_BASE_URL}${image}` : "";
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
    description: stripHtml(entry.description || entry.description_html || ""),
    poster,
    backdrop: screenshot ? `${SHIKIMORI_BASE_URL}${screenshot}` : "",
    url: entry.url ? `${SHIKIMORI_BASE_URL}${entry.url}` : "",
  };
}

function normalizeJikan(entry) {
  if (!entry) return null;
  const titles = entry.titles || [];
  const defaultTitle = titles.find((item) => item.type === "Default")?.title || entry.title || "";
  const englishTitle = entry.title_english || titles.find((item) => item.type === "English")?.title || "";
  const poster = entry.images?.webp?.large_image_url || entry.images?.jpg?.large_image_url || entry.images?.webp?.image_url || entry.images?.jpg?.image_url || "";
  return {
    provider: JIKAN,
    providerId: entry.mal_id,
    russianTitle: "",
    englishTitle: englishTitle || defaultTitle,
    originalTitle: defaultTitle || englishTitle,
    score: entry.score ? Number(entry.score) : null,
    status: entry.status || "",
    kind: entry.type || "",
    episodes: entry.episodes || null,
    episodesAired: entry.episodes || null,
    airedOn: entry.aired?.from || "",
    releasedOn: entry.aired?.to || "",
    description: stripHtml(entry.synopsis || entry.background || ""),
    poster,
    backdrop: poster,
    url: entry.url || "",
    genres: [...(entry.genres || []), ...(entry.themes || []), ...(entry.demographics || [])].map((item) => item.name).filter(Boolean),
  };
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function jikanCandidate(entry) {
  return {
    ...entry,
    name: entry.title || entry.title_english || "",
    russian: "",
    english: [entry.title_english, ...(entry.titles || []).filter((item) => item.type === "English").map((item) => item.title)].filter(Boolean),
    synonyms: [...(entry.title_synonyms || []), ...(entry.titles || []).map((item) => item.title)].filter(Boolean),
  };
}

async function searchJikan(title) {
  const key = cleanTitle(title).toLowerCase();
  if (!key || key.length < 2) return null;
  const cached = cacheGet(JIKAN, key);
  if (cached) return cached;

  try {
    let picked = null;
    for (const variant of searchVariants(title)) {
      const url = new URL("/v4/anime", JIKAN_BASE_URL);
      url.searchParams.set("q", variant);
      url.searchParams.set("limit", "8");
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "AniWRLD metadata resolver",
        },
      });
      if (!response.ok) {
        console.warn(`Jikan metadata search failed for "${variant}": HTTP ${response.status}`);
        continue;
      }
      const entries = (await response.json()).data || [];
      const candidate = bestCandidate(variant, entries.map(jikanCandidate));
      if (candidate?.entry && candidate.score >= 0.55) {
        picked = { entry: candidate.entry, score: candidate.score };
        console.info(`Jikan metadata matched "${title}" as "${candidate.entry.title}" (#${candidate.entry.mal_id}, score ${candidate.score.toFixed(2)})`);
        break;
      }
    }
    if (!picked?.entry) {
      console.warn(`Jikan metadata not found for "${title}"`);
      return null;
    }
    const metadata = normalizeJikan(picked.entry);
    if (metadata) cacheSet(JIKAN, key, metadata);
    return metadata;
  } catch (error) {
    console.warn(`Jikan metadata lookup failed for "${title}": ${error.cause?.code || error.message}`);
    return null;
  }
}

async function searchShikimori(title) {
  const key = cleanTitle(title).toLowerCase();
  if (!key || key.length < 2) return null;
  const cached = cacheGet(SHIKIMORI, key);
  if (cached) return cached;

  try {
    let picked = null;
    for (const variant of searchVariants(title)) {
      const url = new URL("/api/animes", SHIKIMORI_BASE_URL);
      url.searchParams.set("search", variant);
      url.searchParams.set("limit", "8");
      url.searchParams.set("order", "popularity");
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "AniWRLD metadata resolver",
        },
      });
      if (!response.ok) {
        console.warn(`Shikimori metadata search failed for "${variant}": HTTP ${response.status}`);
        continue;
      }
      const entries = await response.json();
      const candidate = bestCandidate(variant, entries);
      if (candidate?.entry && candidate.score >= 0.55) {
        picked = candidate;
        console.info(`Shikimori metadata matched "${title}" as "${candidate.entry.name}" (#${candidate.entry.id}, score ${candidate.score.toFixed(2)})`);
        break;
      }
    }
    if (!picked?.entry) {
      console.warn(`Shikimori metadata not found for "${title}"`);
      return null;
    }
    const entry = picked.entry;
    let metadata = normalizeShikimori(entry);
    if (metadata?.providerId) {
      const details = await fetch(`${SHIKIMORI_BASE_URL}/api/animes/${metadata.providerId}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "AniWRLD metadata resolver",
        },
      });
      if (details.ok) metadata = normalizeShikimori(await details.json()) || metadata;
    }
    if (metadata) cacheSet(SHIKIMORI, key, metadata);
    return metadata;
  } catch (error) {
    console.warn(`Shikimori metadata lookup failed for "${title}": ${error.cause?.code || error.message}`);
    return null;
  }
}

function applyMetadata(item, metadata) {
  if (!metadata) return item;
  return {
    ...item,
    title: metadata.russianTitle || item.title || metadata.englishTitle,
    originalTitle: item.originalTitle || metadata.originalTitle,
    rating: item.rating || metadata.score,
    desc: metadata.description || item.desc,
    image: metadata.poster || item.image,
    backdrop: metadata.backdrop || item.backdrop,
    genres: item.genres?.length ? item.genres : metadata.genres?.length ? metadata.genres : ["Anime"],
    genre: item.genre && item.genre !== "Series" && item.genre !== "Episode" ? item.genre : "Anime",
    metadata,
  };
}

export async function enrichItem(item) {
  const lookup = item.seriesTitle || item.title;
  const metadata = providerName() === SHIKIMORI ? await searchShikimori(lookup) : await searchJikan(lookup);
  return applyMetadata(item, metadata);
}

export async function enrichItems(items) {
  const enriched = [];
  for (const item of items) {
    enriched.push(await enrichItem(item));
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  return enriched;
}
