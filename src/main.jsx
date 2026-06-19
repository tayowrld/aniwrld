import React, { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, Check, Grid2X2, Heart, Library, List,
  Folder, FolderOpen, HardDrive, LogOut, Menu, Play, RefreshCw, Search, Settings,
  Palette, Shield, SlidersHorizontal, Sparkles, Star, UserPlus, X,
} from "lucide-react";
import { authApi } from "./lib/auth";
import { directories, mediaApi } from "./lib/media";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import "./styles.css";

const colors = ["violet", "cyan", "coral", "amber", "blue", "rose"];
const themes = [
  { id: "aniwrld", label: "AniWRLD" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "rosepine", label: "Rosé Pine" },
  { id: "everforest", label: "Everforest" },
];
const qualitySteps = [1080, 720, 480, 360, 144];

function cookieKey(account) {
  return `aniwrld_favorites_${account?.username || "guest"}`;
}

function readFavoriteCookie(account) {
  const entry = document.cookie.split("; ").find((row) => row.startsWith(`${cookieKey(account)}=`));
  if (!entry) return new Set();
  try { return new Set(JSON.parse(decodeURIComponent(entry.split("=").slice(1).join("=")))); }
  catch { return new Set(); }
}

function writeFavoriteCookie(account, ids) {
  const value = encodeURIComponent(JSON.stringify([...ids].slice(0, 300)));
  document.cookie = `${cookieKey(account)}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function mergeCookieFavorites(items, account) {
  const ids = readFavoriteCookie(account);
  return items.map((item) => ids.has(item.id) ? { ...item, favorite: true } : item);
}

function Poster({ show, className = "" }) {
  if (show.image) return <div className={`poster poster--image ${className}`} style={{ backgroundImage: `url("${show.image}")` }} />;
  return <div className={`poster poster--${show.color || colors[String(show.id).length % colors.length]} ${className}`}>
    <div className="poster__moon" /><div className="poster__land" />
    <span className="poster__kanji">夢</span><span className="poster__title">{show.title}</span>
  </div>;
}

function LibrarySetup({ onConfigured, deploymentPath }) {
  const [browser, setBrowser] = useState(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!deploymentPath) directories("").then(setBrowser).catch((loadError) => setError(loadError.message));
  }, [deploymentPath]);
  const open = (path) => directories(path).then(setBrowser).catch((loadError) => setError(loadError.message));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { onConfigured(await mediaApi.setup(deploymentPath || selected || browser.path)); }
    catch (setupError) { setError(setupError.message); }
    finally { setBusy(false); }
  };
  return <div className="connect-screen"><div className="ambient ambient--one" /><div className="ambient ambient--two" />
    <form className="connect-card library-setup" onSubmit={submit}>
      <span className="logo__mark"><HardDrive /></span><p className="eyebrow eyebrow--accent">Последний шаг</p>
      <h1>Выберите папку<br /><em>со всеми релизами.</em></h1>
      <p>Подойдёт локальная или смонтированная облачная папка. Индексация, обложки и обновления дальше работают автоматически.</p>
      {deploymentPath ? <div className="media-summary"><HardDrive /><span><strong>Папка подключена при развёртывании</strong><small>{deploymentPath}</small></span></div> : <div className="folder-browser"><button type="button" className="folder-current" onClick={() => open(browser?.parent)} disabled={!browser}><FolderOpen />{browser?.path || "Загрузка..."}</button>
        <div>{browser?.directories.map((entry) => <button type="button" key={entry.path} className={selected === entry.path ? "active" : ""} onClick={() => setSelected(entry.path)} onDoubleClick={() => open(entry.path)}><Folder />{entry.name}</button>)}</div>
      </div>}
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button connect-button" disabled={busy || (!deploymentPath && !selected && !browser?.path)}>{busy ? <RefreshCw className="spin" /> : <Sparkles />}Подготовить медиатеку</button>
    </form></div>;
}

function AuthScreen({ state, onAuthenticated }) {
  const [mode, setMode] = useState(state.setupRequired ? "setup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = mode === "setup" || mode === "register";
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = register ? await authApi.register(username, password) : await authApi.login(username, password);
      onAuthenticated(result.user);
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  };
  return <div className="connect-screen"><div className="ambient ambient--one" /><div className="ambient ambient--two" />
    <form className="connect-card" onSubmit={submit}><span className="logo__mark">{state.setupRequired ? <Shield /> : register ? <UserPlus /> : <Sparkles />}</span>
      <p className="eyebrow eyebrow--accent">{state.setupRequired ? "Первый запуск" : register ? "Новый аккаунт" : "Добро пожаловать"}</p>
      <h1>{state.setupRequired ? <>Создайте аккаунт<br /><em>администратора.</em></> : register ? <>Создайте свой<br /><em>аккаунт.</em></> : <>Войдите в свой<br /><em>мир аниме.</em></>}</h1>
      <p>{state.setupRequired ? "Первый аккаунт обязателен и получит полные права управления AniWRLD." : "Ваша библиотека и настройки доступны только после входа."}</p>
      <label>Имя пользователя<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>Пароль<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={register ? "new-password" : "current-password"} required /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button connect-button" disabled={busy}>{busy ? <RefreshCw className="spin" /> : register ? <UserPlus /> : <Sparkles />}{register ? "Создать аккаунт" : "Войти"}</button>
      {!state.setupRequired && state.registrationEnabled && <button className="demo-button" type="button" onClick={() => { setMode(register ? "login" : "register"); setError(""); }}>{register ? "У меня уже есть аккаунт" : "Зарегистрироваться"}</button>}
    </form>
  </div>;
}

function AdminSettings({ onClose, media }) {
  const [enabled, setEnabled] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([authApi.settings(), authApi.users()]).then(([settings, list]) => { setEnabled(settings.registrationEnabled); setUsers(list.users); }).catch((loadError) => setError(loadError.message));
  }, []);
  const toggle = async () => {
    try { const result = await authApi.setRegistration(!enabled); setEnabled(result.registrationEnabled); }
    catch (toggleError) { setError(toggleError.message); }
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="admin-panel" onClick={(event) => event.stopPropagation()}>
    <button className="modal__close" onClick={onClose}><X /></button><p className="eyebrow eyebrow--accent">Администрирование</p><h2>Доступ к AniWRLD</h2>
    <button className="setting-row" onClick={toggle}><span><strong>Открытая регистрация</strong><small>Разрешить новым пользователям создавать аккаунты</small></span><i className={enabled ? "active" : ""}><b /></i></button>
    <div className="media-summary"><HardDrive /><span><strong>Источник медиатеки</strong><small>{media.libraryPath || "Не настроен"} · {media.status === "ready" ? "актуальна" : "идёт индексация"}</small></span></div>
    <p className="eyebrow">Пользователи · {users.length}</p><div className="user-list">{users.map((user) => <div key={user.id}><span className="profile__avatar">{user.username.slice(0, 2).toUpperCase()}</span><strong>{user.username}</strong><small>{user.role === "admin" ? "Администратор" : "Пользователь"}</small></div>)}</div>
    {error && <div className="form-error">{error}</div>}
  </div></div>;
}

function DetailsModal({ show, onClose, onPlay, onToggleFavorite, busy }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(show.type === "Series");
  const [error, setError] = useState("");
  const [season, setSeason] = useState("all");

  useEffect(() => {
    let cancelled = false;
    if (show.type !== "Series") {
      setEpisodes([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError("");
    mediaApi.episodes(show.id)
      .then((items) => {
        if (cancelled) return;
        setEpisodes(items);
        const firstSeason = items[0]?.seasonNumber ? String(items[0].seasonNumber) : "all";
        setSeason(firstSeason);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [show]);

  const seasons = useMemo(() => [...new Set(episodes.map((item) => item.seasonNumber).filter(Boolean))], [episodes]);
  const visibleEpisodes = useMemo(() => {
    const filteredEpisodes = episodes.filter((item) => season === "all" || String(item.seasonNumber) === season);
    return filteredEpisodes.length ? filteredEpisodes : episodes;
  }, [episodes, season]);
  const primaryAction = episodes.find((item) => item.progress > 0) || episodes.find((item) => !item.played) || episodes[0] || show;

  return <div className="modal-backdrop" onClick={onClose}><div className="modal modal--details" onClick={(event) => event.stopPropagation()}>
    <Poster show={show} className="modal__poster" />
    <button className="modal__close" onClick={onClose}><X /></button>
    <div className="modal__body">
      <span className="hero__label"><i /> {show.genre}</span>
      <h2>{show.title}</h2>
      <p>{show.desc}</p>
      <div className="modal__meta">
        {show.rating && <span><Star fill="currentColor" />{show.rating}</span>}
        <span>{show.year || "Без года"}</span>
        <span>{show.meta}</span>
      </div>
      <div className="modal__actions">
        <button className="primary-button" onClick={() => onPlay(primaryAction)} disabled={busy}>
          <Play fill="currentColor" />{show.progress ? "Продолжить просмотр" : "Смотреть"}
        </button>
        <button className="glass-button" onClick={() => onToggleFavorite(show)}>
          <Heart fill={show.favorite ? "currentColor" : "none"} />{show.favorite ? "В избранном" : "В избранное"}
        </button>
      </div>
      {show.type === "Series" && <div className="episode-panel">
        <div className="episode-panel__header">
          <strong>Эпизоды</strong>
          {seasons.length > 1 && <div className="genre-scroll episode-panel__seasons">
            {seasons.map((value) => <button key={value} className={season === String(value) ? "active" : ""} onClick={() => setSeason(String(value))}>Сезон {value}</button>)}
          </div>}
        </div>
        {loading && <div className="episode-panel__state"><RefreshCw className="spin" />Загружаем список серий...</div>}
        {!loading && error && <div className="form-error">{error}</div>}
        {!loading && !error && <div className="episode-list">
          {visibleEpisodes.map((episode) => <button key={episode.id} className="episode-row" onClick={() => onPlay(episode)}>
            <span className="episode-row__index">{episode.episodeNumber || "?"}</span>
            <span className="episode-row__body">
              <strong>{episode.title}</strong>
              <small>{episode.meta}</small>
            </span>
            {episode.progress > 0 && <span className="episode-row__progress">{episode.progress}%</span>}
            {episode.progress > 0 && <span className="episode-row__bar"><i style={{ width: `${episode.progress}%` }} /></span>}
          </button>)}
          {!visibleEpisodes.length && <div className="episode-panel__state">Для этого сезона эпизоды не найдены.</div>}
        </div>}
      </div>}
    </div>
  </div></div>;
}

function Player({ playback, onClose, onPlay }) {
  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const lastReport = useRef(0);
  const nextPromptTimer = useRef(null);
  const nextEpisodeRef = useRef(null);
  const nextPromptShown = useRef(false);
  const [playerError, setPlayerError] = useState("");
  const [episodes, setEpisodes] = useState([]);
  const [nextPrompt, setNextPrompt] = useState(false);
  const nextEpisode = useMemo(() => {
    const currentIndex = episodes.findIndex((episode) => episode.id === playback.item.id);
    return currentIndex >= 0 ? episodes[currentIndex + 1] || null : null;
  }, [episodes, playback.item.id]);
  useEffect(() => { nextEpisodeRef.current = nextEpisode; }, [nextEpisode]);

  useEffect(() => {
    let cancelled = false;
    setEpisodes([]);
    setNextPrompt(false);
    nextPromptShown.current = false;
    if (!playback.item.seriesId) return undefined;
    mediaApi.episodes(playback.item.seriesId)
      .then((items) => { if (!cancelled) setEpisodes(items); })
      .catch(() => { if (!cancelled) setEpisodes([]); });
    return () => { cancelled = true; };
  }, [playback.item.id, playback.item.seriesId]);

  useEffect(() => {
    if (!playback) return undefined;
    const video = videoRef.current;
    let hls;
    let cancelled = false;
    lastReport.current = 0;
    setPlayerError("");
    setNextPrompt(false);
    nextPromptShown.current = false;
    clearTimeout(nextPromptTimer.current);

    const report = (kind) => mediaApi.report(kind, playback, video.currentTime || 0, video.paused).catch(() => {});
    const loadHlsSource = (source) => {
      const time = video.currentTime || playback.startSeconds || 0;
      hls.loadSource(source);
      hls.once("hlsLevelLoaded", () => {
        if (time > 0) video.currentTime = time;
        video.play().catch(() => {});
      });
    };
    const createPlyr = (quality = null) => {
      if (cancelled || plyrRef.current) return;
      plyrRef.current = new Plyr(video, {
        autoplay: true,
        captions: { active: false, language: "auto", update: true },
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "pip", "airplay", "fullscreen"],
        i18n: { qualityLabel: { 0: "Auto" } },
        settings: ["captions", ...(quality ? ["quality"] : []), "speed"],
        ...(quality ? { quality } : {}),
      });
    };

    if (playback.directPlay) {
      video.src = playback.directUrl;
      createPlyr();
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data?.fatal) setPlayerError("Поток не удалось открыть. Попробуйте другую серию или обновите библиотеку.");
          });
          hls.loadSource(playback.hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const heights = [...new Set(hls.levels.map((level) => level.height).filter(Boolean))].sort((a, b) => b - a);
            createPlyr({
              default: 0,
              options: [0, ...qualitySteps],
              forced: true,
              onChange: (height) => {
                const selected = Number(height);
                if (selected === 0) {
                  loadHlsSource(playback.hlsUrl);
                  hls.currentLevel = -1;
                  return;
                }
                const levelIndex = hls.levels.findIndex((level) => level.height === selected);
                if (levelIndex >= 0) {
                  hls.currentLevel = levelIndex;
                  return;
                }
                if (playback.qualityUrls?.[selected]) loadHlsSource(playback.qualityUrls[selected]);
              },
            });
          });
        } else {
          video.src = playback.hlsUrl;
          createPlyr();
        }
      });
    }
    const start = () => {
      if (playback.startSeconds) video.currentTime = playback.startSeconds;
      report("start");
    };
    const progress = () => {
      if (Math.abs(video.currentTime - lastReport.current) > 10) {
        lastReport.current = video.currentTime;
        report("progress");
      }
      if (nextEpisodeRef.current && !nextPromptShown.current && video.duration && video.duration - video.currentTime <= 100) {
        setNextPrompt(true);
        nextPromptShown.current = true;
        clearTimeout(nextPromptTimer.current);
        nextPromptTimer.current = setTimeout(() => setNextPrompt(false), 15000);
      }
    };
    const fail = () => setPlayerError("Браузер не смог загрузить видеофайл.");
    const pause = () => report("progress");
    video.addEventListener("loadedmetadata", start, { once: true });
    video.addEventListener("timeupdate", progress);
    video.addEventListener("error", fail);
    video.addEventListener("pause", pause);
    return () => {
      cancelled = true;
      report("stop");
      video.removeEventListener("timeupdate", progress);
      video.removeEventListener("error", fail);
      video.removeEventListener("pause", pause);
      clearTimeout(nextPromptTimer.current);
      plyrRef.current?.destroy();
      plyrRef.current = null;
      hls?.destroy();
    };
  }, [playback]);
  const switchEpisode = (episode) => {
    setNextPrompt(false);
    clearTimeout(nextPromptTimer.current);
    onPlay(episode);
  };
  return <div className="player-backdrop">
    <div className="player-particles"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className={`player-shell ${episodes.length ? "player-shell--series" : ""}`}><div className="player">
    <button className="modal__close" onClick={onClose}><X /></button>
    <video ref={videoRef} autoPlay playsInline>
      {playback.subtitles?.map((track) => <track key={track.src} kind="subtitles" src={track.src} srcLang={track.language} label={track.label} />)}
    </video>
    {nextPrompt && nextEpisode && <button className="player-next-toast" onClick={() => switchEpisode(nextEpisode)}><span>Следующая серия</span><strong>{nextEpisode.title}</strong></button>}
    {playerError && <div className="banner banner--error player__error">{playerError}</div>}
    <div className="player__caption"><strong>{playback.item.seriesTitle || playback.item.title}</strong><span>{playback.item.seriesTitle ? `${playback.item.title} · ${playback.item.meta}` : playback.item.meta}</span></div>
  </div>
    {episodes.length > 0 && <aside className="player-episodes">
      <div className="player-episodes__head"><span>Эпизоды</span>{nextEpisode && <button onClick={() => switchEpisode(nextEpisode)}>Следующая</button>}</div>
      <div className="player-episodes__list">
        {episodes.map((episode) => <button key={episode.id} className={episode.id === playback.item.id ? "active" : ""} onClick={() => switchEpisode(episode)}>
          <span>{episode.episodeNumber || "?"}</span><strong>{episode.title}</strong><small>{episode.meta}</small>
          {episode.progress > 0 && <i style={{ width: `${episode.progress}%` }} />}
        </button>)}
      </div>
    </aside>}
  </div></div>;
}

function App({ account, media, onAccountLogout }) {
  const [shows, setShows] = useState([]);
  const [resume, setResume] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Все");
  const [view, setView] = useState("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeShow, setActiveShow] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [collection, setCollection] = useState("all");
  const [theme, setTheme] = useState(() => localStorage.getItem("aniwrld_theme") || "aniwrld");
  const searchRef = useRef(null);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const [library, continueItems] = await Promise.all([mediaApi.library(), mediaApi.resume()]);
      setShows(mergeCookieFavorites(library, account));
      setResume(mergeCookieFavorites(continueItems, account));
      setError("");
    } catch (loadError) {
      setError(`Не удалось загрузить библиотеку: ${loadError.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLibrary(); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aniwrld_theme", theme);
  }, [theme]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const genres = useMemo(() => ["Все", ...new Set(shows.flatMap((show) => show.genres?.length ? show.genres : [show.genre]))], [shows]);
  const filtered = useMemo(() => shows.filter((show) => {
    const inCollection = collection === "favorites" ? show.favorite : collection === "watched" ? show.played : true;
    const watchedAllowed = !hideWatched || !show.played;
    return inCollection && watchedAllowed && (genre === "Все" || show.genres?.includes(genre) || show.genre === genre) && show.title.toLowerCase().includes(query.toLowerCase());
  }), [shows, genre, query, collection, hideWatched]);
  const favorites = shows.filter((show) => show.favorite).length;
  const watched = shows.filter((show) => show.played).length;
  const heroShow = resume[0] || shows[0] || null;
  const activeTheme = themes.find((item) => item.id === theme) || themes[0];
  const collectionTitle = collection === "favorites" ? "Избранное" : collection === "watched" ? "Просмотрено" : "Все аниме";
  const chooseCollection = (nextCollection) => {
    setCollection(nextCollection);
    setMenuOpen(false);
  };
  const scrollToCollection = () => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const resetFilters = () => {
    setGenre("Все");
    setQuery("");
    setHideWatched(false);
    setCollection("all");
  };

  const logout = async () => { await authApi.logout(); onAccountLogout(); };
  const toggleFavorite = async (show) => {
    const nextValue = !show.favorite;
    const favoriteIds = readFavoriteCookie(account);
    if (nextValue) favoriteIds.add(show.id);
    else favoriteIds.delete(show.id);
    writeFavoriteCookie(account, favoriteIds);
    setShows((current) => current.map((item) => item.id === show.id ? { ...item, favorite: nextValue } : item));
    setResume((current) => current.map((item) => item.id === show.id ? { ...item, favorite: nextValue } : item));
    setActiveShow((current) => current?.id === show.id ? { ...current, favorite: nextValue } : current);
    try { await mediaApi.favorite(show.id, nextValue); } catch { loadLibrary(); }
  };
  const play = async (show) => {
    setBusy(true); setError("");
    try {
      setPlayback(await mediaApi.playback(show));
      setActiveShow(null);
    } catch (playError) { setError(playError.message); }
    finally { setBusy(false); }
  };
  if (loading && !shows.length) return <div className="loading-screen"><span className="logo__mark"><Sparkles /></span><RefreshCw className="spin" /><p>Обновляем медиатеку...</p></div>;

  return <div className="app-shell">
    <div className="particles"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className="ambient ambient--one" /><div className="ambient ambient--two" />
    {menuOpen && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
      <button className="mobile-close" onClick={() => setMenuOpen(false)}><X /></button>
      <a className="logo" href="#"><span className="logo__mark"><Sparkles size={17} /></span><span>ani<span>wrld</span></span></a>
      <nav className="nav"><p className="eyebrow">Смотреть</p>
        <button className={`nav__item ${collection === "all" ? "nav__item--active" : ""}`} onClick={() => chooseCollection("all")}><Library />Библиотека<span className="nav__count">{shows.length}</span></button>
        <a className="nav__item" href="#continue" onClick={() => setMenuOpen(false)}><Play />Продолжить{resume.length > 0 && <span className="nav__dot" />}</a>
        <button className={`nav__item ${collection === "favorites" ? "nav__item--active" : ""}`} onClick={() => chooseCollection("favorites")}><Heart />Избранное<span className="nav__count">{favorites}</span></button>
        <p className="eyebrow">Коллекции</p><button className={`nav__item ${collection === "watched" ? "nav__item--active" : ""}`} onClick={() => chooseCollection("watched")}><Check />Просмотрено<span className="nav__count">{watched}</span></button>
      </nav>
      <div className="server-status"><i /><span><strong>Медиатека</strong><small>{media.status === "ready" ? "Актуальна" : "Индексируется автоматически"}</small></span></div>
      <button className="profile" onClick={logout}><span className="profile__avatar">{account.username.slice(0, 2).toUpperCase()}</span><span><strong>{account.username}</strong><small>{account.role === "admin" ? "Администратор" : "Выйти из аккаунта"}</small></span><LogOut /></button>
    </aside>
    <main>
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
        <label className="search"><Search /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти в библиотеке..." /><kbd>⌘ K</kbd></label>
        <div className="topbar__actions"><div className="theme-select"><Palette /><select value={theme} onChange={(event) => setTheme(event.target.value)} title="Тема">{themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span>{activeTheme.label}</span></div>{account.role === "admin" && <button className="icon-button" onClick={() => setAdminOpen(true)} title="Администрирование"><Settings /></button>}<button className="icon-button" onClick={() => loadLibrary()} title="Обновить экран"><RefreshCw className={loading ? "spin" : ""} /></button></div>
      </header>
      {error && <div className="banner banner--error">{error}<button onClick={() => setError("")}><X /></button></div>}
      {heroShow ? <section className="hero" style={heroShow.backdrop ? { "--hero-image": `url("${heroShow.backdrop}")` } : undefined}>
        <div className="hero__image" /><div className="hero__shade" /><div className="hero__content">
          <span className="hero__label"><i /> {resume.length ? "Продолжить просмотр" : "В вашей библиотеке"}</span>
          <h1>{heroShow.seriesTitle || heroShow.title}<br />{heroShow.originalTitle && <em>{heroShow.originalTitle}</em>}</h1>
          <p>{heroShow.desc}</p><div className="hero__actions"><button className="primary-button" onClick={() => play(heroShow)} disabled={busy}><Play fill="currentColor" />Смотреть</button><button className="glass-button" onClick={() => toggleFavorite(heroShow)}><Heart fill={heroShow.favorite ? "currentColor" : "none"} />{heroShow.favorite ? "В избранном" : "В избранное"}</button></div>
        </div>
      </section> : <section className="empty empty--hero"><Library /><h3>Медиатека пока пуста</h3><p>Подключите релизы и обновите библиотеку, чтобы здесь появился каталог.</p></section>}
      {resume.length > 0 && <section className="section" id="continue"><div className="section__heading"><div><p className="eyebrow eyebrow--accent">С возвращением</p><h2>Продолжить просмотр</h2></div><button className="text-button" onClick={scrollToCollection}>К библиотеке <ArrowRight /></button></div>
        <div className="continue-grid">{resume.slice(0, 3).map((show) => <article className="continue-card" key={show.id} onClick={() => play(show)}><Poster show={show} /><button className="round-play"><Play fill="currentColor" /></button><div className="continue-card__info"><div><h3>{show.seriesTitle || show.title}</h3><p>{show.seriesTitle ? `${show.title} · ${show.meta}` : show.meta}</p></div><span>{show.progress}%</span></div><div className="progress"><i style={{ width: `${show.progress}%` }} /></div></article>)}</div>
      </section>}
      <section className="section" id="collection"><div className="section__heading"><div><p className="eyebrow eyebrow--accent">Ваша коллекция</p><h2>{collectionTitle} <span>{filtered.length}</span></h2></div><div className="view-switch"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Grid2X2 /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List /></button></div></div>
        <div className="filter-row"><div className="genre-scroll">{genres.map((item) => <button key={item} className={genre === item ? "active" : ""} onClick={() => setGenre(item)}>{item}</button>)}</div><button className={`filter-button ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal />Фильтры</button></div>
        {filtersOpen && <div className="filter-panel"><button className={`setting-row filter-toggle ${hideWatched ? "active" : ""}`} onClick={() => setHideWatched((value) => !value)}><span><strong>Скрыть просмотренное</strong><small>Оставить в выдаче только то, что еще не закончено.</small></span><i><b /></i></button><button className="filter-reset" onClick={resetFilters}>Сбросить фильтры</button></div>}
        <div className={view === "grid" ? "library-grid" : "library-list"}>{filtered.map((show) => <article className="show-card" key={show.id} onClick={() => setActiveShow(show)}><div className="show-card__poster"><Poster show={show} />{show.rating && <span className="rating"><Star fill="currentColor" />{show.rating}</span>}<button className={`favorite ${show.favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); toggleFavorite(show); }}><Heart fill="currentColor" /></button></div><div className="show-card__info"><div><h3>{show.title}</h3><p>{show.year || "—"} · {show.genre} · {show.meta}</p></div></div>{show.progress > 0 && <div className="progress"><i style={{ width: `${show.progress}%` }} /></div>}</article>)}</div>
        {!filtered.length && <div className="empty"><Search /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или жанр.</p></div>}
      </section>
    </main>
    {activeShow && <DetailsModal show={activeShow} busy={busy} onClose={() => setActiveShow(null)} onPlay={play} onToggleFavorite={toggleFavorite} />}
    {playback && <Player key={playback.item.id} playback={playback} onPlay={play} onClose={() => { setPlayback(null); loadLibrary(); }} />}
    {adminOpen && <AdminSettings media={media} onClose={() => setAdminOpen(false)} />}
  </div>;
}

function Root() {
  const [state, setState] = useState(null);
  useEffect(() => { authApi.status().then(setState).catch(() => setState({ setupRequired: false, registrationEnabled: false, user: null })); }, []);
  if (!state) return <div className="loading-screen"><span className="logo__mark"><Sparkles /></span><RefreshCw className="spin" /><p>Запускаем AniWRLD...</p></div>;
  if (!state.user) return <AuthScreen state={state} onAuthenticated={(user) => setState((current) => ({ ...current, setupRequired: false, user }))} />;
  if (!state.media?.configured) {
    if (state.user.role === "admin") return <LibrarySetup deploymentPath={state.media?.deploymentPath} onConfigured={(media) => setState((current) => ({ ...current, media }))} />;
    return <div className="loading-screen"><span className="logo__mark"><HardDrive /></span><p>Владелец ещё подготавливает медиатеку.</p></div>;
  }
  return <App account={state.user} media={state.media} onAccountLogout={() => setState((current) => ({ ...current, user: null }))} />;
}

createRoot(document.getElementById("root")).render(<StrictMode><Root /></StrictMode>);
