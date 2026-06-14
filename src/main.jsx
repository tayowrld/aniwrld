import React, { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, Bookmark, Check, Grid2X2, Heart, Library, List,
  Folder, FolderOpen, HardDrive, LogOut, Menu, MoreHorizontal, Play, RefreshCw, Search, Settings,
  Shield, SlidersHorizontal, Sparkles, Star, UserPlus, X,
} from "lucide-react";
import { demoShows } from "./data/demo";
import { authApi } from "./lib/auth";
import { directories, mediaApi } from "./lib/media";
import "./styles.css";

const colors = ["violet", "cyan", "coral", "amber", "blue", "rose"];

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

function Player({ playback, onClose }) {
  const videoRef = useRef(null);
  const lastReport = useRef(0);
  useEffect(() => {
    if (!playback) return undefined;
    const video = videoRef.current;
    let hls;
    let cancelled = false;
    if (playback.directPlay) {
      video.src = playback.directUrl;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(playback.hlsUrl);
          hls.attachMedia(video);
        } else {
          video.src = playback.hlsUrl;
        }
      });
    }
    const start = () => {
      if (playback.startSeconds) video.currentTime = playback.startSeconds;
      mediaApi.report("start", playback, video.currentTime).catch(() => {});
    };
    const progress = () => {
      if (video.currentTime - lastReport.current > 10) {
        lastReport.current = video.currentTime;
        mediaApi.report("progress", playback, video.currentTime, video.paused).catch(() => {});
      }
    };
    video.addEventListener("loadedmetadata", start, { once: true });
    video.addEventListener("timeupdate", progress);
    return () => {
      cancelled = true;
      mediaApi.report("stop", playback, video.currentTime, video.paused).catch(() => {});
      video.removeEventListener("timeupdate", progress);
      hls?.destroy();
    };
  }, [playback]);
  return <div className="player-backdrop"><div className="player">
    <button className="modal__close" onClick={onClose}><X /></button>
    <video ref={videoRef} controls autoPlay playsInline />
    <div className="player__caption"><strong>{playback.item.title}</strong><span>{playback.item.meta}</span></div>
  </div></div>;
}

function App({ account, media, onAccountLogout }) {
  const [shows, setShows] = useState([]);
  const [resume, setResume] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Все");
  const [view, setView] = useState("grid");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeShow, setActiveShow] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const [library, continueItems] = await Promise.all([mediaApi.library(), mediaApi.resume()]);
      setShows(library); setResume(continueItems); setError("");
    } catch (loadError) {
      setError(`Не удалось загрузить библиотеку: ${loadError.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLibrary(); }, []);

  const genres = useMemo(() => ["Все", ...new Set(shows.flatMap((show) => show.genres?.length ? show.genres : [show.genre]))], [shows]);
  const filtered = useMemo(() => shows.filter((show) => (genre === "Все" || show.genres?.includes(genre) || show.genre === genre) && show.title.toLowerCase().includes(query.toLowerCase())), [shows, genre, query]);
  const favorites = shows.filter((show) => show.favorite).length;
  const heroShow = resume[0] || shows[0] || demoShows[0];

  const logout = async () => { await authApi.logout(); onAccountLogout(); };
  const toggleFavorite = async (show) => {
    const nextValue = !show.favorite;
    setShows((current) => current.map((item) => item.id === show.id ? { ...item, favorite: nextValue } : item));
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
    <div className="ambient ambient--one" /><div className="ambient ambient--two" />
    <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
      <button className="mobile-close" onClick={() => setMenuOpen(false)}><X /></button>
      <a className="logo" href="#"><span className="logo__mark"><Sparkles size={17} /></span><span>ani<span>wrld</span></span></a>
      <nav className="nav"><p className="eyebrow">Смотреть</p>
        <a className="nav__item nav__item--active" href="#"><Library />Библиотека<span className="nav__count">{shows.length}</span></a>
        <a className="nav__item" href="#continue"><Play />Продолжить{resume.length > 0 && <span className="nav__dot" />}</a>
        <a className="nav__item" href="#collection"><Heart />Избранное<span className="nav__count">{favorites}</span></a>
        <p className="eyebrow">Коллекции</p><a className="nav__item" href="#collection"><Bookmark />Хочу посмотреть</a><a className="nav__item" href="#collection"><Check />Просмотрено</a>
      </nav>
      <div className="server-status"><i /><span><strong>Медиатека</strong><small>{media.status === "ready" ? "Актуальна" : "Индексируется автоматически"}</small></span></div>
      <button className="profile" onClick={logout}><span className="profile__avatar">{account.username.slice(0, 2).toUpperCase()}</span><span><strong>{account.username}</strong><small>{account.role === "admin" ? "Администратор" : "Выйти из аккаунта"}</small></span><LogOut /></button>
    </aside>
    <main>
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
        <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти в библиотеке..." /><kbd>⌘ K</kbd></label>
        <div className="topbar__actions">{account.role === "admin" && <button className="icon-button" onClick={() => setAdminOpen(true)} title="Администрирование"><Settings /></button>}<button className="icon-button" onClick={() => loadLibrary()} title="Обновить экран"><RefreshCw className={loading ? "spin" : ""} /></button></div>
      </header>
      {error && <div className="banner banner--error">{error}<button onClick={() => setError("")}><X /></button></div>}
      {notice && <div className="banner">{notice}</div>}
      <section className="hero" style={heroShow.backdrop ? { "--hero-image": `url("${heroShow.backdrop}")` } : undefined}>
        <div className="hero__image" /><div className="hero__shade" /><div className="hero__content">
          <span className="hero__label"><i /> {resume.length ? "Продолжить просмотр" : "В вашей библиотеке"}</span>
          <h1>{heroShow.title}<br />{heroShow.originalTitle && <em>{heroShow.originalTitle}</em>}</h1>
          <p>{heroShow.desc}</p><div className="hero__actions"><button className="primary-button" onClick={() => play(heroShow)} disabled={busy}><Play fill="currentColor" />Смотреть</button><button className="glass-button" onClick={() => toggleFavorite(heroShow)}><Heart fill={heroShow.favorite ? "currentColor" : "none"} />{heroShow.favorite ? "В избранном" : "В избранное"}</button></div>
        </div>
      </section>
      {resume.length > 0 && <section className="section" id="continue"><div className="section__heading"><div><p className="eyebrow eyebrow--accent">С возвращением</p><h2>Продолжить просмотр</h2></div><button className="text-button">Смотреть все <ArrowRight /></button></div>
        <div className="continue-grid">{resume.slice(0, 3).map((show) => <article className="continue-card" key={show.id} onClick={() => play(show)}><Poster show={show} /><button className="round-play"><Play fill="currentColor" /></button><div className="continue-card__info"><div><h3>{show.title}</h3><p>{show.meta}</p></div><span>{show.progress}%</span></div><div className="progress"><i style={{ width: `${show.progress}%` }} /></div></article>)}</div>
      </section>}
      <section className="section" id="collection"><div className="section__heading"><div><p className="eyebrow eyebrow--accent">Ваша коллекция</p><h2>Все аниме <span>{filtered.length}</span></h2></div><div className="view-switch"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Grid2X2 /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List /></button></div></div>
        <div className="filter-row"><div className="genre-scroll">{genres.map((item) => <button key={item} className={genre === item ? "active" : ""} onClick={() => setGenre(item)}>{item}</button>)}</div><button className="filter-button"><SlidersHorizontal />Фильтры</button></div>
        <div className={view === "grid" ? "library-grid" : "library-list"}>{filtered.map((show) => <article className="show-card" key={show.id} onClick={() => setActiveShow(show)}><div className="show-card__poster"><Poster show={show} />{show.rating && <span className="rating"><Star fill="currentColor" />{show.rating}</span>}<button className={`favorite ${show.favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); toggleFavorite(show); }}><Heart fill="currentColor" /></button><button className="show-card__play" onClick={(event) => { event.stopPropagation(); play(show); }}><Play fill="currentColor" /></button></div><div className="show-card__info"><div><h3>{show.title}</h3><p>{show.year || "—"} · {show.genre} · {show.meta}</p></div><button><MoreHorizontal /></button></div>{show.progress > 0 && <div className="progress"><i style={{ width: `${show.progress}%` }} /></div>}</article>)}</div>
        {!filtered.length && <div className="empty"><Search /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или жанр.</p></div>}
      </section>
    </main>
    {activeShow && <div className="modal-backdrop" onClick={() => setActiveShow(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><Poster show={activeShow} className="modal__poster" /><button className="modal__close" onClick={() => setActiveShow(null)}><X /></button><div className="modal__body"><span className="hero__label"><i /> {activeShow.genre}</span><h2>{activeShow.title}</h2><p>{activeShow.desc}</p><div className="modal__meta">{activeShow.rating && <span><Star fill="currentColor" />{activeShow.rating}</span>}<span>{activeShow.year || "Без года"}</span><span>{activeShow.meta}</span></div><button className="primary-button" onClick={() => play(activeShow)}><Play fill="currentColor" />{activeShow.progress ? "Продолжить просмотр" : "Начать просмотр"}</button></div></div></div>}
    {playback && <Player playback={playback} onClose={() => { setPlayback(null); loadLibrary(); }} />}
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
