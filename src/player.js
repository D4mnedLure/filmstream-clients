import { hlsMasterUrl } from './api.js'
import { currentUser } from './auth.js'
import { createFocus } from './nav.js'
import { go } from './flows.js'

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

// movie: detail payload { name, is_series, seasons:[{season,episodes:[]}], translations:[{index,label}] }
export function createPlayerScreen(kpId, movie) {
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

  let app = null
  let playing = false
  let buffering = false
  let duration = 0
  let currentTime = 0
  let overlayTimer = null
  let menuOpen = false
  let menuFocus = null
  let retried = false

  // ── AVPlay ────────────────────────────────────────────────────────────────
  function avSafe(fn) {
    try { return fn() } catch (_) { return null }
  }

  // Explicitly enable the first AUDIO track — Tizen sometimes prepares without
  // it. (The backend already remuxes to MPEG-TS with a single AAC track.)
  function selectAudio() {
    const tracks = avSafe(() => AV.getTotalTrackInfo()) || []
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].type === 'AUDIO') {
        avSafe(() => AV.setSelectTrack('AUDIO', tracks[i].index))
        return
      }
    }
  }

  function trLabel() {
    for (let i = 0; i < translations.length; i++) {
      if (translations[i].index === translation) return translations[i].label
    }
    return ''
  }

  function start() {
    const url = hlsMasterUrl(kpId, translation, season, episode)
    if (!AV) {
      showError('AVPlay недоступен (запущено не на Tizen TV).\n' + url)
      return
    }
    // Reflect the active dub in the title (updates on translation switch).
    const tl = app && app.querySelector('.po-title')
    if (tl) {
      tl.textContent = (movie.name || '') +
        (isSeries && season != null ? ' · S' + season + 'E' + episode : '') +
        (trLabel() ? ' · ' + trLabel() : '')
    }
    retried = false
    buffering = true
    updateBuffering()
    avSafe(() => AV.stop())
    avSafe(() => AV.close())
    try {
      AV.open(url)
      AV.setDisplayRect(0, 0, 1920, 1080)
      avSafe(() => AV.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'))
      // Start at the lowest variant so playback begins fast (small first
      // segments), then let ABR ramp up — otherwise AVPlay prebuffers a big
      // 1080p buffer before showing anything ("adski dolgo").
      avSafe(() => AV.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=LOWEST|SKIPBITRATE=HIGHEST'))
      // Start after a small buffer instead of AVPlay's large default prebuffer.
      avSafe(() => AV.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 2))
      AV.setListener({
        onbufferingstart: () => { buffering = true; updateBuffering() },
        onbufferingcomplete: () => { buffering = false; updateBuffering() },
        oncurrentplaytime: (ms) => { currentTime = ms; updateProgress() },
        onstreamcompleted: () => onCompleted(),
        onerror: (e) => onAvError(e),
        onevent: () => {},
      })
      AV.prepareAsync(function () {
        duration = avSafe(() => AV.getDuration()) || 0
        selectAudio()
        try { AV.play(); playing = true } catch (e) { onAvError(e) }
        buffering = false
        updateBuffering()
        updateProgress()
        showOverlay()
      }, function (e) { onAvError(e) })
    } catch (e) {
      showError('Ошибка AVPlay: ' + ((e && e.message) || e))
    }
  }

  function onAvError() {
    // A dead JWT makes every segment 401 -> AVPlay errors. Bounce to login.
    if (!currentUser()) { stopAv(); go.login(); return }
    // Otherwise try one clean re-open (covers a stale CDN session).
    if (!retried) { retried = true; start(); return }
    showError('Ошибка воспроизведения. Нажмите Back и попробуйте снова.')
  }

  function onCompleted() {
    const nxt = nextEpisode()
    if (nxt) { season = nxt.season; episode = nxt.episode; start(); return }
    playing = false
    showOverlay(true)
  }

  function stopAv() {
    avSafe(() => AV && AV.stop())
    avSafe(() => AV && AV.close())
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
    if (!AV) return
    if (playing) { avSafe(() => AV.pause()); playing = false }
    else { avSafe(() => AV.play()); playing = true }
    showOverlay()
  }
  function seek(deltaMs) {
    if (!AV) return
    if (deltaMs >= 0) avSafe(() => AV.jumpForward(deltaMs))
    else avSafe(() => AV.jumpBackward(-deltaMs))
    showOverlay()
  }

  // ── Overlay / rendering ─────────────────────────────────────────────────────
  function showError(msg) {
    if (!app) return
    app.innerHTML = '<div class="screen"><div class="tagline" style="color:#f87171;white-space:pre-wrap">' + esc(msg) + '</div><div class="hint">Back — назад</div></div>'
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
      '<object id="av-player" type="application/avplayer"></object>' +
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
    document.documentElement.classList.add('avplay')
    start()
  }

  function dispose() {
    if (overlayTimer) clearTimeout(overlayTimer)
    stopAv()
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
        return false // let main pop -> dispose() stops AVPlay
      default:
        return false
    }
  }

  return { render, key, dispose }
}
