import { hlsMasterUrl, sendProgress } from './api.js'
import { currentUser } from './auth.js'
import { createFocus } from './nav.js'
import { go } from './flows.js'

// Tizen exposes webapis.avplay (hardware player behind the page). Everywhere
// else (Android WebView / desktop browser) we use <video> + hls.js — modern
// engines decode the source CMAF/fMP4 natively, so no fmt=ts remux either.
const AV = (typeof window !== 'undefined' && window.webapis && window.webapis.avplay) || null

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fmt(ms) {
  if (!ms || ms < 0) ms = 0
  const t = Math.floor(ms / 1000)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return (h > 0 ? h + ':' + pad(m) : m) + ':' + pad(s)
}

function avSafe(fn) {
  try { return fn() } catch (_) { return null }
}

// ── Engines ──────────────────────────────────────────────────────────────────
// Interface: html() → markup for render; load(url, seekMs); play(); pause();
// seekBy(deltaMs); stop(). Events arrive via the shared `ev` callbacks:
// onTime(ms), onDuration(ms), onBuffering(bool), onEnded(), onError(e), onReady().

function createAvplayEngine(ev) {
  function selectAudio() {
    // Tizen sometimes prepares without the audio track enabled — select it.
    const tracks = avSafe(() => AV.getTotalTrackInfo()) || []
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].type === 'AUDIO') {
        avSafe(() => AV.setSelectTrack('AUDIO', tracks[i].index))
        return
      }
    }
  }
  return {
    html: () => '<object id="av-player" type="application/avplayer"></object>',
    load(url, seekMs) {
      avSafe(() => AV.stop())
      avSafe(() => AV.close())
      AV.open(url)
      AV.setDisplayRect(0, 0, 1920, 1080)
      avSafe(() => AV.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'))
      // Start at the lowest variant + small buffer for a fast first frame.
      avSafe(() => AV.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=LOWEST|SKIPBITRATE=HIGHEST'))
      avSafe(() => AV.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 2))
      AV.setListener({
        onbufferingstart: () => ev.onBuffering(true),
        onbufferingcomplete: () => ev.onBuffering(false),
        oncurrentplaytime: (ms) => ev.onTime(ms),
        onstreamcompleted: () => ev.onEnded(),
        onerror: (e) => ev.onError(e),
        onevent: () => {},
      })
      AV.prepareAsync(function () {
        const duration = avSafe(() => AV.getDuration()) || 0
        ev.onDuration(duration)
        selectAudio()
        if (seekMs > 2000 && (!duration || seekMs < duration - 10000)) {
          avSafe(() => (AV.seekTo ? AV.seekTo(seekMs) : AV.jumpForward(seekMs)))
          ev.onTime(seekMs)
        }
        try { AV.play() } catch (e) { ev.onError(e); return }
        ev.onReady()
      }, function (e) { ev.onError(e) })
    },
    play: () => avSafe(() => AV.play()),
    pause: () => avSafe(() => AV.pause()),
    seekBy(deltaMs) {
      if (deltaMs >= 0) avSafe(() => AV.jumpForward(deltaMs))
      else avSafe(() => AV.jumpBackward(-deltaMs))
    },
    stop() {
      avSafe(() => AV.stop())
      avSafe(() => AV.close())
    },
  }
}

function createHtml5Engine(ev) {
  let video = null
  let hls = null

  function bind(v) {
    v.addEventListener('timeupdate', () => ev.onTime(v.currentTime * 1000))
    v.addEventListener('durationchange', () => {
      if (isFinite(v.duration)) ev.onDuration(v.duration * 1000)
    })
    v.addEventListener('waiting', () => ev.onBuffering(true))
    v.addEventListener('playing', () => ev.onBuffering(false))
    v.addEventListener('canplay', () => ev.onBuffering(false))
    v.addEventListener('ended', () => ev.onEnded())
    v.addEventListener('error', () => ev.onError(v.error))
  }

  return {
    html: () => '<video id="html5-player" autoplay playsinline></video>',
    load(url, seekMs) {
      if (hls) { hls.destroy(); hls = null }
      video = document.getElementById('html5-player')
      if (!video) { ev.onError(new Error('no video element')); return }
      if (!video._bound) { bind(video); video._bound = true }
      const seekOnce = function () {
        if (seekMs > 2000 && (!video.duration || seekMs / 1000 < video.duration - 10)) {
          video.currentTime = seekMs / 1000
        }
      }
      // hls.js is loaded lazily so the Tizen bundle (AVPlay path) never parses
      // its ~0.5 MB on the old TV engine.
      import('hls.js')
        .then((mod) => {
          const Hls = mod.default || mod
          if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 30 })
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
              seekOnce()
              const p = video.play()
              if (p && p.catch) p.catch(() => {})
              ev.onReady()
            })
            hls.on(Hls.Events.ERROR, function (_e, data) {
              if (!data.fatal) return
              // One transparent recovery for network/media hiccups, then bail.
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
              else ev.onError(data)
            })
            hls.loadSource(url)
            hls.attachMedia(video)
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url
            video.addEventListener('loadedmetadata', function once() {
              video.removeEventListener('loadedmetadata', once)
              seekOnce()
              const p = video.play()
              if (p && p.catch) p.catch(() => {})
              ev.onReady()
            })
          } else {
            ev.onError(new Error('HLS не поддерживается этим устройством'))
          }
        })
        .catch((e) => ev.onError(e))
    },
    play() { if (video) { const p = video.play(); if (p && p.catch) p.catch(() => {}) } },
    pause() { if (video) video.pause() },
    seekBy(deltaMs) {
      if (!video) return
      let t = video.currentTime + deltaMs / 1000
      if (t < 0) t = 0
      if (video.duration && t > video.duration - 1) t = video.duration - 1
      video.currentTime = t
    },
    stop() {
      if (hls) { hls.destroy(); hls = null }
      if (video) {
        video.pause()
        video.removeAttribute('src')
        try { video.load() } catch (_) {}
      }
    },
  }
}

// movie: detail payload { name, poster, is_series, seasons:[{season,episodes:[]}], translations:[{index,label}] }
// resume (optional): { translation, season, episode, position_sec } to jump in.
export function createPlayerScreen(kpId, movie, resume) {
  movie = movie || {}
  const isSeries = !!movie.is_series
  const translations = movie.translations && movie.translations.length ? movie.translations : [{ index: 0, label: 'Оригинал' }]
  const seasons = movie.seasons || []

  let translation = translations[0].index
  let season = null
  let episode = null
  if (isSeries && seasons.length) {
    season = seasons[0].season
    episode = seasons[0].episodes && seasons[0].episodes.length ? seasons[0].episodes[0] : 1
  }
  // Apply resume selection (translation/episode) so we re-open where the user left off.
  if (resume) {
    if (resume.translation != null) translation = resume.translation
    if (isSeries && resume.season != null) { season = resume.season; episode = resume.episode }
  }
  // Seek applied once, on the first successful prepare (not on episode switches).
  let pendingSeekMs = resume && resume.position_sec ? resume.position_sec * 1000 : 0

  let app = null
  let playing = false
  let buffering = false
  let duration = 0
  let currentTime = 0
  let overlayTimer = null
  let hbTimer = null
  let menuOpen = false
  let menuFocus = null
  let retried = false

  const engine = (AV ? createAvplayEngine : createHtml5Engine)({
    onTime: (ms) => { currentTime = ms; updateProgress() },
    onDuration: (ms) => { duration = ms; updateProgress() },
    onBuffering: (b) => { buffering = b; updateBuffering() },
    onEnded: () => onCompleted(),
    onError: (e) => onPlayError(e),
    onReady: () => {
      playing = true
      buffering = false
      updateBuffering()
      updateProgress()
      showOverlay()
    },
  })

  // ── Progress heartbeat (личный кабинет: cross-device resume) ────────────────
  function progressBody() {
    return {
      kp_id: kpId,
      season: season || 0,
      episode: episode || 0,
      position_sec: Math.floor(currentTime / 1000),
      duration_sec: Math.floor(duration / 1000),
      translation: translation || 0,
      title: movie.name || '',
      poster: movie.poster || '',
      is_series: isSeries,
    }
  }
  function heartbeat() {
    if (duration > 0 && currentTime > 0) sendProgress(progressBody())
  }

  function trLabel() {
    for (let i = 0; i < translations.length; i++) {
      if (translations[i].index === translation) return translations[i].label
    }
    return ''
  }

  function start() {
    // Tizen AVPlay can't decode the source CMAF audio → ask for the MPEG-TS
    // remux. Modern engines (hls.js) play the original fMP4 as-is.
    const url = hlsMasterUrl(kpId, translation, season, episode, !!AV)
    // Reflect the active dub in the title (updates on translation switch).
    const tl = app && app.querySelector('.po-title')
    if (tl) {
      tl.textContent = (movie.name || '') +
        (isSeries && season != null ? ' · S' + season + 'E' + episode : '') +
        (trLabel() ? ' · ' + trLabel() : '')
    }
    retried = false
    buffering = true
    playing = false
    updateBuffering()
    try {
      engine.load(url, pendingSeekMs)
    } catch (e) {
      showError('Ошибка плеера: ' + ((e && e.message) || e))
      return
    }
    pendingSeekMs = 0
  }

  function onPlayError() {
    // A dead JWT makes every segment 401 -> player errors. Bounce to login.
    if (!currentUser()) { engine.stop(); go.login(); return }
    // Otherwise try one clean re-open (covers a stale CDN session).
    if (!retried) { retried = true; start(); return }
    showError('Ошибка воспроизведения. Нажмите Back и попробуйте снова.')
  }

  function onCompleted() {
    heartbeat() // position ≈ duration → backend marks it completed
    const nxt = nextEpisode()
    if (nxt) { season = nxt.season; episode = nxt.episode; start(); return }
    playing = false
    showOverlay(true)
  }

  // ── Series episode helpers ──────────────────────────────────────────────────
  function nextEpisode() {
    if (!isSeries) return null
    for (let i = 0; i < seasons.length; i++) {
      if (seasons[i].season !== season) continue
      const eps = seasons[i].episodes || []
      const idx = eps.indexOf(episode)
      if (idx >= 0 && idx < eps.length - 1) return { season: season, episode: eps[idx + 1] }
      if (i < seasons.length - 1) {
        const ne = seasons[i + 1].episodes || []
        if (ne.length) return { season: seasons[i + 1].season, episode: ne[0] }
      }
      return null
    }
    return null
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  function togglePlay() {
    if (playing) { engine.pause(); playing = false; heartbeat() }
    else { engine.play(); playing = true }
    showOverlay()
  }
  function seek(deltaMs) {
    engine.seekBy(deltaMs)
    showOverlay()
  }

  // ── Overlay / rendering ─────────────────────────────────────────────────────
  function showError(msg) {
    if (!app) return
    app.innerHTML = '<div class="screen"><div class="tagline" style="color:#d9736a;white-space:pre-wrap">' + esc(msg) + '</div><div class="hint">Back — назад</div></div>'
  }

  function updateBuffering() {
    const el = app && app.querySelector('#buf')
    if (el) el.style.display = buffering ? 'flex' : 'none'
  }
  function updateProgress() {
    if (!app) return
    const cur = app.querySelector('#p-cur')
    const dur = app.querySelector('#p-dur')
    const bar = app.querySelector('#p-bar-fill')
    const pp = app.querySelector('#p-state')
    if (cur) cur.textContent = fmt(currentTime)
    if (dur) dur.textContent = fmt(duration)
    if (bar) bar.style.width = duration ? (Math.min(100, (currentTime / duration) * 100)) + '%' : '0%'
    if (pp) pp.textContent = playing ? '❚❚' : '▶'
  }
  function showOverlay(sticky) {
    const ov = app && app.querySelector('#overlay')
    if (!ov) return
    ov.style.display = 'block'
    updateProgress()
    if (overlayTimer) clearTimeout(overlayTimer)
    if (!sticky && playing) overlayTimer = setTimeout(hideOverlay, 4000)
  }
  function hideOverlay() {
    const ov = app && app.querySelector('#overlay')
    if (ov) ov.style.display = 'none'
  }

  function menuHtml() {
    let html = '<div id="menu" class="player-menu"><div class="pm-title">Настройки</div>'
    html += '<div class="pm-section">Перевод</div><div class="pm-row">'
    for (let i = 0; i < translations.length; i++) {
      const t = translations[i]
      const on = t.index === translation ? ' on' : ''
      html += '<div class="chip focusable' + on + '" data-trans="' + esc(t.index) + '">' + esc(t.label) + '</div>'
    }
    html += '</div>'
    if (isSeries) {
      for (let s = 0; s < seasons.length; s++) {
        const se = seasons[s]
        html += '<div class="pm-section">Сезон ' + esc(se.season) + '</div><div class="pm-row">'
        const eps = se.episodes || []
        for (let e = 0; e < eps.length; e++) {
          const on = se.season === season && eps[e] === episode ? ' on' : ''
          html += '<div class="chip focusable' + on + '" data-ep="' + esc(se.season) + ':' + esc(eps[e]) + '">' + esc(eps[e]) + '</div>'
        }
        html += '</div>'
      }
    }
    return html + '</div>'
  }

  function openMenu() {
    menuOpen = true
    const m = app.querySelector('#menu')
    if (m) m.style.display = 'block'
    menuFocus = createFocus(m)
    menuFocus.focusFirst()
    wireMenu()
  }
  function closeMenu() {
    menuOpen = false
    const m = app.querySelector('#menu')
    if (m) m.style.display = 'none'
  }
  function wireMenu() {
    const m = app.querySelector('#menu')
    const chips = Array.prototype.slice.call(m.querySelectorAll('.chip'))
    for (let i = 0; i < chips.length; i++) {
      chips[i].onclick = (function (el) {
        return function () {
          const tr = el.getAttribute('data-trans')
          const ep = el.getAttribute('data-ep')
          if (tr != null) { translation = parseInt(tr, 10); closeMenu(); start() }
          else if (ep != null) {
            const parts = ep.split(':')
            season = parseInt(parts[0], 10)
            episode = parseInt(parts[1], 10)
            closeMenu(); start()
          }
        }
      })(chips[i])
    }
  }

  function render(container) {
    app = container
    const title = esc(movie.name || '') + (isSeries && season != null ? ' · S' + season + 'E' + episode : '')
    app.innerHTML =
      engine.html() +
      '<div id="buf" class="buffering"><div class="spinner"></div><div class="buf-label">Загрузка…</div></div>' +
      '<div id="overlay" class="player-overlay">' +
      '  <div class="po-title">' + title + '</div>' +
      '  <div class="po-bar"><div id="p-bar-fill" class="po-bar-fill"></div></div>' +
      '  <div class="po-line"><span id="p-state">▶</span>' +
      '    <span class="po-time"><span id="p-cur">0:00</span> / <span id="p-dur">0:00</span></span>' +
      '    <span class="po-hint">OK — пауза · ←/→ 10c · ↑ меню · Back — выход</span>' +
      '  </div>' +
      '</div>' +
      menuHtml()
    const menu = app.querySelector('#menu')
    if (menu) menu.style.display = 'none'
    // On Tizen the video plane is BEHIND the page — the page must go transparent.
    if (AV) document.documentElement.classList.add('avplay')
    hbTimer = setInterval(heartbeat, 15000)
    start()
  }

  function dispose() {
    if (overlayTimer) clearTimeout(overlayTimer)
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null }
    heartbeat() // save the final position on exit
    engine.stop()
    document.documentElement.classList.remove('avplay')
  }

  function key(name) {
    if (menuOpen) {
      if (name === 'BACK') { closeMenu(); return true }
      if (name === 'ENTER') { menuFocus.activate(); return true }
      if (name === 'UP' || name === 'DOWN' || name === 'LEFT' || name === 'RIGHT') { menuFocus.move(name); return true }
      return true
    }
    switch (name) {
      case 'ENTER':
      case 'MEDIA_PLAY_PAUSE':
        togglePlay(); return true
      case 'MEDIA_PLAY':
        if (!playing) togglePlay(); return true
      case 'MEDIA_PAUSE':
        if (playing) togglePlay(); return true
      case 'LEFT':
        seek(-10000); return true
      case 'RIGHT':
        seek(10000); return true
      case 'MEDIA_RW':
        seek(-30000); return true
      case 'MEDIA_FF':
        seek(30000); return true
      case 'UP':
        openMenu(); return true
      case 'DOWN':
        showOverlay(); return true
      case 'BACK':
        return false // let main pop -> dispose() stops the engine
      default:
        return false
    }
  }

  return { render, key, dispose }
}
