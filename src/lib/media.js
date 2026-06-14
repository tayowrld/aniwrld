async function request(path, options = {}) {
  const response = await fetch(`/api/media${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка медиатеки.");
  return data;
}

export const mediaApi = {
  library: async () => (await request("/library")).items,
  resume: async () => (await request("/resume")).items,
  setup: async (libraryPath) => (await request("/setup", { method: "POST", body: JSON.stringify({ libraryPath }) })).media,
  favorite: (id, value) => request("/favorite", { method: "POST", body: JSON.stringify({ id, value }) }),
  scan: () => request("/scan", { method: "POST" }),
  playback: (item) => request("/playback", { method: "POST", body: JSON.stringify(item) }),
  report: (kind, playback, seconds, paused = false) => request(`/report/${kind}`, {
    method: "POST",
    body: JSON.stringify({
      ItemId: playback.item.id, MediaSourceId: playback.mediaSourceId, PlaySessionId: playback.playSessionId,
      seconds, IsPaused: paused, PlayMethod: playback.directPlay ? "DirectPlay" : "Transcode",
    }),
  }),
};

export async function directories(path) {
  const response = await fetch(`/api/admin/directories?path=${encodeURIComponent(path || "")}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Папка недоступна.");
  return data;
}
