async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка сервера.");
  return data;
}

export const authApi = {
  status: () => request("/auth/status"),
  login: (username, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username, password) => request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  settings: () => request("/settings"),
  setRegistration: (enabled) => request("/settings/registration", { method: "PATCH", body: JSON.stringify({ enabled }) }),
  users: () => request("/admin/users"),
};
