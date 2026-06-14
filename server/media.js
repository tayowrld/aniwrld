import { existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting } from "./db.js";

const CLIENT = "AniWRLD";
const VERSION = "0.3.0";
const DEVICE_ID = "aniwrld-server";
const TICKS_PER_SECOND = 10_000_000;

function baseUrl() {
  return (process.env.ANIWRLD_MEDIA_ENGINE_URL || getSetting("media_engine_url", "http://127.0.0.1:8096")).replace(/\/+$/, "");
}

function authHeader(token = "") {
  return `MediaBrowser Client="${CLIENT}", Device="AniWRLD Server", DeviceId="${DEVICE_ID}", Version="${VERSION}"${token ? `, Token="${token}"` : ""}`;
}

async function raw(path, options = {}, token = getSetting("media_engine_token", "")) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(token),
      "X-Emby-Authorization": authHeader(token),
      ...(token ? { "X-Emby-Token": token } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Медиадвижок вернул ${response.status}${details ? `: ${details.slice(0, 300)}` : ""}`);
  }
  return response;
}

async function request(path, options, token) {
  const response = await raw(path, options, token);
  return response.status === 204 ? null : response.json();
}

async function ensureEngine() {
  try {
    const response = await fetch(`${baseUrl()}/System/Info/Public`);
    if (response.ok) return;
  } catch {}
  if (process.env.ANIWRLD_MEDIA_ENGINE_COMMAND) {
    try {
      const child = spawn(process.env.ANIWRLD_MEDIA_ENGINE_COMMAND, [], { detached: true, stdio: "ignore" });
      child.on("error", () => {});
      child.unref();
    } catch {}
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const response = await fetch(`${baseUrl()}/System/Info/Public`);
      if (response.ok) return;
    } catch {}
  }
  throw new Error("Внутренняя медиасистема недоступна. Запустите полный стек через Docker Compose.");
}

function percent(userData) {
  return userData?.PlayedPercentage ? Math.round(userData.PlayedPercentage) : 0;
}

function formatRuntime(ticks) {
  const minutes = Math.round((ticks || 0) / TICKS_PER_SECOND / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}ч ${minutes % 60}м` : `${minutes}м`;
}

function mapItem(item) {
  const isSeries = item.Type === "Series";
  return {
    id: item.Id,
    title: item.Name,
    originalTitle: item.OriginalTitle,
    year: item.ProductionYear,
    rating: item.CommunityRating ? Number(item.CommunityRating.toFixed(1)) : null,
    genre: item.Genres?.[0] || (isSeries ? "Сериал" : "Фильм"),
    genres: item.Genres || [],
    meta: isSeries ? `${item.ChildCount || item.RecursiveItemCount || "?"} серий` : `Фильм${item.RunTimeTicks ? ` · ${formatRuntime(item.RunTimeTicks)}` : ""}`,
    desc: item.Overview || "Описание пока не добавлено.",
    progress: percent(item.UserData),
    favorite: Boolean(item.UserData?.IsFavorite),
    played: Boolean(item.UserData?.Played),
    type: item.Type,
    image: `/api/media/image/${item.Id}/Primary?width=700`,
    backdrop: item.BackdropImageTags?.length ? `/api/media/image/${item.Id}/Backdrop?width=1600` : null,
    positionTicks: item.UserData?.PlaybackPositionTicks || 0,
  };
}

export function mediaState() {
  return {
    configured: Boolean(getSetting("library_path")) && Boolean(getSetting("media_engine_token")),
    status: getSetting("media_engine_status", "not_configured"),
    libraryPath: getSetting("library_path", ""),
    deploymentPath: process.env.ANIWRLD_LIBRARY_PATH || "",
  };
}

export async function configureMediaOwner(username, libraryPath) {
  const path = String(process.env.ANIWRLD_LIBRARY_PATH || libraryPath || "").trim();
  if (!path || !existsSync(path) || !statSync(path).isDirectory()) throw new Error("Выбранная папка недоступна серверу.");
  setSetting("media_engine_status", "connecting");
  try {
    await ensureEngine();
    let password = getSetting("media_engine_password", "");
    if (!password) {
      password = randomBytes(32).toString("base64url");
      setSetting("media_engine_password", password);
    }
    const publicInfo = await (await fetch(`${baseUrl()}/System/Info/Public`)).json();
    let engineUsername = getSetting("media_engine_username", username);
    if (publicInfo.StartupWizardCompleted === false) {
      const startupUser = await request("/Startup/User", undefined, "");
      engineUsername = startupUser?.Name || username;
      await request("/Startup/Configuration", {
        method: "POST",
        body: JSON.stringify({ UICulture: "ru-RU", MetadataCountryCode: "RU", PreferredMetadataLanguage: "ru" }),
      }, "");
      await request("/Startup/User", { method: "POST", body: JSON.stringify({ Name: engineUsername, Password: password }) }, "");
      await request("/Startup/RemoteAccess", { method: "POST", body: JSON.stringify({ EnableRemoteAccess: false, EnableAutomaticPortMapping: false }) }, "");
      await request("/Startup/Complete", { method: "POST" }, "");
    }
    const auth = await request("/Users/AuthenticateByName", {
      method: "POST",
      body: JSON.stringify({ Username: engineUsername, Pw: password }),
    }, "");
    setSetting("media_engine_token", auth.AccessToken);
    setSetting("media_engine_user_id", auth.User.Id);
    setSetting("media_engine_username", engineUsername);
    setSetting("library_path", path);
    const folders = await request("/Library/VirtualFolders");
    const exists = folders.some((folder) => folder.Locations?.includes(path));
    if (!exists) {
      const query = new URLSearchParams({ name: "AniWRLD", collectionType: "tvshows", paths: path, refreshLibrary: "true" });
      await request(`/Library/VirtualFolders?${query}`, {
        method: "POST",
        body: JSON.stringify({ LibraryOptions: {} }),
      });
    }
    await request("/Library/Refresh", { method: "POST" });
    setSetting("media_engine_status", "indexing");
    return mediaState();
  } catch (error) {
    setSetting("media_engine_status", "engine_unavailable");
    console.error("Media engine setup failed:", error);
    throw new Error(`Не удалось подготовить внутреннюю медиасистему: ${error.message}`);
  }
}

function userId() {
  const value = getSetting("media_engine_user_id", "");
  if (!value) throw new Error("Медиатека ещё не настроена.");
  return value;
}

export async function getLibrary() {
  const query = new URLSearchParams({
    Recursive: "true", IncludeItemTypes: "Series,Movie",
    Fields: "Overview,Genres,CommunityRating,BackdropImageTags,RecursiveItemCount,OriginalTitle",
    ImageTypeLimit: "1", EnableImageTypes: "Primary,Backdrop", SortBy: "SortName",
  });
  const data = await request(`/Users/${userId()}/Items?${query}`);
  setSetting("media_engine_status", "ready");
  return data.Items.map(mapItem);
}

export async function getResume() {
  const query = new URLSearchParams({ MediaTypes: "Video", Limit: "12", Fields: "Overview,Genres,CommunityRating,BackdropImageTags,SeriesInfo" });
  const data = await request(`/Users/${userId()}/Items/Resume?${query}`);
  return data.Items.map(mapItem);
}

export async function favorite(id, value) {
  return request(`/Users/${userId()}/FavoriteItems/${id}`, { method: value ? "POST" : "DELETE" });
}

export async function scan() {
  setSetting("media_engine_status", "indexing");
  return request("/Library/Refresh", { method: "POST" });
}

async function resolvePlayable(item) {
  if (item.type !== "Series") return item;
  const query = new URLSearchParams({ UserId: userId(), IsMissing: "false", Fields: "Overview,Genres,CommunityRating,BackdropImageTags,SeriesInfo" });
  const data = await request(`/Shows/${item.id}/Episodes?${query}`);
  const episode = data.Items.find((entry) => entry.UserData?.PlaybackPositionTicks > 0) || data.Items.find((entry) => !entry.UserData?.Played) || data.Items[0];
  if (!episode) throw new Error("В сериале нет доступных эпизодов.");
  return mapItem(episode);
}

export async function playback(item) {
  const playable = await resolvePlayable(item);
  const info = await request(`/Items/${playable.id}/PlaybackInfo?UserId=${userId()}`, {
    method: "POST",
    body: JSON.stringify({ UserId: userId(), StartTimeTicks: playable.positionTicks || 0, AutoOpenLiveStream: true }),
  });
  const source = info.MediaSources?.[0];
  if (!source) throw new Error("Источник воспроизведения не найден.");
  const params = new URLSearchParams({
    UserId: userId(), MediaSourceId: source.Id, DeviceId: DEVICE_ID, PlaySessionId: info.PlaySessionId || "",
    VideoCodec: "h264", AudioCodec: "aac", TranscodingContainer: "ts", SegmentContainer: "ts",
    MinSegments: "1", BreakOnNonKeyFrames: "true",
  });
  return {
    item: playable, mediaSourceId: source.Id, playSessionId: info.PlaySessionId,
    directPlay: Boolean(source.SupportsDirectPlay && ["mp4", "webm"].includes(source.Container?.toLowerCase())),
    directUrl: `/api/media/stream/${playable.id}?source=${encodeURIComponent(source.Id)}`,
    hlsUrl: `/api/media/hls/${playable.id}?${params}`,
    startSeconds: (playable.positionTicks || 0) / TICKS_PER_SECOND,
  };
}

export async function report(kind, data) {
  const path = kind === "start" ? "/Sessions/Playing" : kind === "stop" ? "/Sessions/Playing/Stopped" : "/Sessions/Playing/Progress";
  return request(path, { method: "POST", body: JSON.stringify({ ...data, PositionTicks: Math.round(data.seconds * TICKS_PER_SECOND), CanSeek: true }) });
}

export async function proxyImage(id, type, width) {
  return raw(`/Items/${id}/Images/${type}?maxWidth=${Number(width) || 900}&quality=90`);
}

export async function proxyStream(id, source) {
  return raw(`/Videos/${id}/stream?static=true&MediaSourceId=${encodeURIComponent(source)}`, { headers: { "Content-Type": undefined } });
}

export async function proxyHls(id, search) {
  return raw(`/Videos/${id}/master.m3u8?${search}`);
}

export async function proxyAbsolute(url) {
  if (!url.startsWith(`${baseUrl()}/`)) throw new Error("Недопустимый адрес медиадвижка.");
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(getSetting("media_engine_token", "")),
      "X-Emby-Authorization": authHeader(getSetting("media_engine_token", "")),
      "X-Emby-Token": getSetting("media_engine_token", ""),
    },
  });
  if (!response.ok) throw new Error(`Медиадвижок вернул ${response.status}`);
  return response;
}

export function rewritePlaylist(text) {
  return text.replace(/^(?!#)(.+)$/gm, (line) => {
    const absolute = new URL(line.trim(), `${baseUrl()}/`).toString();
    return `/api/media/proxy?url=${encodeURIComponent(absolute)}`;
  }).replace(/URI="([^"]+)"/g, (_, uri) => {
    const absolute = new URL(uri, `${baseUrl()}/`).toString();
    return `URI="/api/media/proxy?url=${encodeURIComponent(absolute)}"`;
  });
}
