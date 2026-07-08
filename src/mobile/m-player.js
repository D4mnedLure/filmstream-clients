import { hlsMasterUrl, sendProgress, getMovie } from '../api.js'
import { createHtml5Engine } from '../player.js'
import { esc, fmtTime, ICONS, openSheet } from './m-ui.js'
import { back } from './m-router.js'
import { getCachedMovie, cacheMovie } from './m-state.js'

// Touch player: fixed fullscreen <video>, tap toggles the controls, bottom
// sheets pick the dub / episode. Same backend contract as the TV player
// (?token= in the HLS URL, progress heartbeat, resume).
export function createPlayer(params, query) {
  const kpId = +params[0]
  let movie = getCachedMovie(kpId)
  let translation = +(query.tr || 0)
  let season = query.s != null ? +query.s : null
  let episode = query.e != null ? +query.e : null
  let pendingSeekMs = query.t ? +query.t * 1000 : 0

  let app = null
  let playing = false
  let duration = 0
  let currentTime = 0
  let uiTimer = null
  let hbTimer = null
  let scrubbing = false
  let disposed = false

  const engine = createHtml5Engine({
    onTime: (ms) => { currentTime = ms; if (!scrubbing) updateProgress() },
    onDuration: (ms) => { duration = ms; updateProgress() },
    onBuffering: (b) => { const el = q('#pl-buf'); if (el) el.style.display = b ? 'block' : 'none' },
    onEnded: () => onCompleted(),
    onError: () => showError(),
    onReady: () => { playing = true; updateProgress(); showUi() },
  })

  function q(sel) { return app ? app.querySelector(sel) : null }

  function translations() {
    return movie && movie.translations && movie.translations.length
      ? movie.translations
      : [{ index: 0, label: 'Оригинал' }]
  }
  function trLabel() {
    const list = translations()
    for (let i = 0; i < list.length; i++) if (list[i].index === translation) return list[i].label
    return list[0].label
  }

  function titleText() {
    return (movie ? movie.name : '') +
      (movie && movie.is_series && season != null ? ' · S' + season + 'E' + episode : '') +
      ' · ' + trLabel()
  }

  function progressBody() {
    return {
      kp_id: kpId, season: season || 0, episode: episode || 0,
      position_sec: Math.floor(currentTime / 1000), duration_sec: Math.floor(duration / 1000),
      translation: translation || 0, title: (movie && movie.name) || '',
      poster: (movie && movie.poster) || '', is_series: !!(movie && movie.is_series),
    }
  }
  function heartbeat() { if (duration > 0 && currentTime > 0) sendProgress(progressBody()) }

  function start() {
    const t = q('.pl-title')
    if (t) t.textContent = titleText()
    engine.load(hlsMasterUrl(kpId, translation, season, episode, false), pendingSeekMs)
    pendingSeekMs = 0
  }

  function onCompleted() {
    heartbeat()
    const nxt = nextEpisode()
    if (nxt) { season = nxt.season; episode = nxt.episode; start(); return }
    playing = false
    updateProgress()
    showUi(true)
  }

  function nextEpisode() {
    if (!movie || !movie.is_series) return null
    const seasons = movie.seasons || []
    for (let i = 0; i < seasons.length; i++) {
      if (seasons[i].season !== season) continue
      const eps = seasons[i].episodes || []
      const idx = eps.indexOf(episode)
      if (idx >= 0 && idx < eps.length - 1) return { season: season, episode: eps[idx + 1] }
      if (i < seasons.length - 1 && (seasons[i + 1].episodes || []).length) {
        return { season: seasons[i + 1].season, episode: seasons[i + 1].episodes[0] }
      }
      return null
    }
    return null
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  function updateProgress() {
    const cur = q('#pl-cur'); const dur = q('#pl-dur'); const seek = q('#pl-seek'); const pp = q('#pl-pp')
    if (cur) cur.textContent = fmtTime(currentTime / 1000)
    if (dur) dur.textContent = fmtTime(duration / 1000)
    if (seek && !scrubbing) seek.value = duration ? Math.round((currentTime / duration) * 1000) : 0
    if (pp) pp.innerHTML = playing ? ICONS.pause : ICONS.play
  }

  function showUi(sticky) {
    const ui = q('.pl-ui')
    if (!ui) return
    ui.classList.remove('hidden')
    if (uiTimer) clearTimeout(uiTimer)
    if (!sticky && playing) uiTimer = setTimeout(hideUi, 3500)
  }
  function hideUi() {
    const ui = q('.pl-ui')
    if (ui) ui.classList.add('hidden')
  }

  function showError() {
    const t = q('.pl-title')
    if (t) t.textContent = 'Ошибка воспроизведения'
    showUi(true)
  }

  function togglePlay() {
    if (playing) { engine.pause(); playing = false; heartbeat() }
    else { engine.play(); playing = true }
    updateProgress()
    showUi()
  }

  function render(container) {
    app = container
    app.innerHTML =
      '<div class="pl-root">' +
      '  <video id="html5-player" autoplay playsinline webkit-playsinline></video>' +
      '  <div class="pl-buf spinner" id="pl-buf" style="display:none"></div>' +
      '  <div class="pl-ui">' +
      '    <div class="pl-top"><div class="back-btn" id="pl-back">' + ICONS.back + '</div>' +
      '      <div class="pl-title">' + esc(titleText()) + '</div></div>' +
      '    <div class="pl-center">' +
      '      <div class="pl-cbtn" id="pl-rw">' + ICONS.rw + '</div>' +
      '      <div class="pl-cbtn big" id="pl-pp">' + ICONS.play + '</div>' +
      '      <div class="pl-cbtn" id="pl-ff">' + ICONS.ff + '</div>' +
      '    </div>' +
      '    <div class="pl-bottom">' +
      '      <input id="pl-seek" class="pl-seek" type="range" min="0" max="1000" value="0" step="1">' +
      '      <div class="pl-times"><span id="pl-cur">0:00</span><span id="pl-dur">0:00</span></div>' +
      '      <div class="pl-row">' +
      '        <div class="pl-chipbtn" id="pl-dub">Озвучка</div>' +
      (movie && movie.is_series ? '<div class="pl-chipbtn" id="pl-ep">Серия</div>' : '<span id="pl-ep"></span>') +
      '        <div class="pl-chipbtn" id="pl-fs" style="margin-left:auto">' + ICONS.fullscreen + '</div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>'

    q('#pl-back').addEventListener('click', (e) => { e.stopPropagation(); back('#/movie/' + kpId) })
    q('#pl-pp').addEventListener('click', (e) => { e.stopPropagation(); togglePlay() })
    q('#pl-rw').addEventListener('click', (e) => { e.stopPropagation(); engine.seekBy(-10000); showUi() })
    q('#pl-ff').addEventListener('click', (e) => { e.stopPropagation(); engine.seekBy(10000); showUi() })
    q('#pl-dub').addEventListener('click', (e) => { e.stopPropagation(); pickDub() })
    q('#pl-fs').addEventListener('click', (e) => { e.stopPropagation(); goFullscreen() })
    const ep = q('#pl-ep')
    if (ep && ep.addEventListener && movie && movie.is_series) {
      ep.addEventListener('click', (e) => { e.stopPropagation(); pickEpisode() })
    }
    // Tap on the video toggles the controls.
    q('.pl-root').addEventListener('click', () => {
      const ui = q('.pl-ui')
      if (ui.classList.contains('hidden')) showUi()
      else hideUi()
    })
    const seek = q('#pl-seek')
    seek.addEventListener('input', () => {
      scrubbing = true
      const cur = q('#pl-cur')
      if (cur && duration) cur.textContent = fmtTime((seek.value / 1000) * duration / 1000)
      showUi(true)
    })
    seek.addEventListener('change', () => {
      scrubbing = false
      if (duration) {
        const target = (seek.value / 1000) * duration
        engine.seekBy(target - currentTime)
      }
      showUi()
    })
    ;['click', 'touchstart', 'touchend'].forEach((t) =>
      seek.addEventListener(t, (e) => e.stopPropagation()))

    hbTimer = setInterval(heartbeat, 15000)
    if (movie) start()
    else {
      getMovie(kpId).then((d) => {
        movie = d
        cacheMovie(kpId, d)
        if (movie.is_series && season == null && (movie.seasons || []).length) {
          season = movie.seasons[0].season
          episode = (movie.seasons[0].episodes || [1])[0]
        }
        if (!disposed) {
          const epBtn = q('#pl-ep')
          if (epBtn && movie.is_series && !epBtn.className) {
            epBtn.className = 'pl-chipbtn'
            epBtn.textContent = 'Серия'
            epBtn.addEventListener('click', (e) => { e.stopPropagation(); pickEpisode() })
          }
          start()
        }
      }).catch(() => showError())
    }
    if (movie && movie.is_series && season == null && (movie.seasons || []).length) {
      season = movie.seasons[0].season
      episode = (movie.seasons[0].episodes || [1])[0]
    }
  }

  function pickDub() {
    const list = translations()
    openSheet('Озвучка', list.map((t) => ({ label: t.label, value: t.index, on: t.index === translation })), (v) => {
      translation = +v
      start()
    })
  }

  function pickEpisode() {
    const seasons = (movie && movie.seasons) || []
    const items = []
    for (let i = 0; i < seasons.length; i++) {
      const eps = seasons[i].episodes || []
      for (let j = 0; j < eps.length; j++) {
        items.push({
          label: 'Сезон ' + seasons[i].season + ' · Серия ' + eps[j],
          value: seasons[i].season + ':' + eps[j],
          on: seasons[i].season === season && eps[j] === episode,
        })
      }
    }
    openSheet('Серия', items, (v) => {
      const p = v.split(':')
      season = +p[0]
      episode = +p[1]
      start()
    })
  }

  function goFullscreen() {
    const v = document.getElementById('html5-player')
    if (!v) return
    try {
      if (v.webkitEnterFullscreen) v.webkitEnterFullscreen() // iOS native player UI
      else if (v.requestFullscreen) v.requestFullscreen()
    } catch (_) {}
  }

  function dispose() {
    disposed = true
    if (uiTimer) clearTimeout(uiTimer)
    if (hbTimer) clearInterval(hbTimer)
    heartbeat()
    engine.stop()
  }

  return { render, dispose }
}
