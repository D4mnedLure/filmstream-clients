import { getMovie, getLibraryState, getProgressFor, addLibrary, removeLibrary } from './api.js'
import { createFocus } from './nav.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fmtSec(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return (h > 0 ? h + ':' + pad(m) : m) + ':' + pad(s)
}

export function createDetailScreen(kpId) {
  let data = null
  let libState = { in_watchlist: false, in_favorites: false }
  let progress = null
  let status = 'loading' // loading | ok | error
  let focus = null
  let app = null

  function libPayload(statusKind) {
    return {
      kp_id: kpId,
      status: statusKind,
      title: data && data.name,
      poster: data && data.poster,
      is_series: !!(data && data.is_series),
      year: data && data.year,
    }
  }

  function detailHtml() {
    const d = data
    const poster = d.poster
      ? '<img class="d-poster" src="' + esc(d.poster) + '" alt="">'
      : '<div class="d-poster placeholder">нет постера</div>'
    const meta = []
    if (d.year) meta.push(esc(d.year))
    if (d.rating_kp) meta.push('★ ' + esc(d.rating_kp))
    if (d.is_series) meta.push('сериал' + (d.seasons_count ? ' · ' + esc(d.seasons_count) + ' сез.' : ''))
    const genres = (d.genres || []).map((g) => '<span class="chip">' + esc(g) + '</span>').join('')
    const trans = (d.translations || [])
      .map((t) => '<span class="chip">' + esc(t.label) + '</span>')
      .join('') || '<span class="muted">переводы недоступны</span>'
    const dirs = (d.directors || []).length ? 'Режиссёр: ' + esc((d.directors || []).join(', ')) : ''

    const canResume = progress && progress.position_sec > 15 && !progress.completed
    const watchLabel = canResume ? '▶ Продолжить с ' + fmtSec(progress.position_sec) : '▶ Смотреть'
    const wl = libState.in_watchlist
    const fav = libState.in_favorites

    return (
      '<div class="screen detail">' +
      '  <div class="d-top">' + poster +
      '    <div class="d-info">' +
      '      <div class="d-title">' + esc(d.name) + '</div>' +
      (d.original_name ? '<div class="d-orig">' + esc(d.original_name) + '</div>' : '') +
      '      <div class="d-meta">' + meta.join(' · ') + '</div>' +
      '      <div class="d-genres">' + genres + '</div>' +
      '      <div class="d-syn">' + esc(d.synopsis || '') + '</div>' +
      (dirs ? '<div class="d-dirs">' + dirs + '</div>' : '') +
      '      <div class="d-trans-label">Переводы:</div><div class="d-trans">' + trans + '</div>' +
      '      <div class="d-actions">' +
      '        <div id="watch" class="btn focusable" tabindex="0">' + watchLabel + '</div>' +
      '        <div id="wl" class="btn toggle focusable' + (wl ? ' on' : '') + '" tabindex="0">' +
      (wl ? '✓ В списке' : '＋ Буду смотреть') + '</div>' +
      '        <div id="fav" class="btn toggle focusable' + (fav ? ' on' : '') + '" tabindex="0">' +
      (fav ? '♥ В избранном' : '♡ В избранное') + '</div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="hint" id="d-hint">Пульт: <b>OK</b> — выбрать · <b>Back</b> — назад</div>' +
      '</div>'
    )
  }

  function view() {
    if (status === 'loading') {
      return '<div class="screen"><div class="logo">Film<span class="accent">Stream</span></div><div class="tagline">Загрузка…</div></div>'
    }
    if (status === 'error') {
      return '<div class="screen"><div class="tagline" style="color:#f87171">Не удалось загрузить фильм</div><div class="hint">Back — назад</div></div>'
    }
    return detailHtml()
  }

  function resumeArg() {
    if (!progress || progress.completed || !(progress.position_sec > 15)) return null
    return {
      translation: progress.translation || 0,
      season: progress.season || null,
      episode: progress.episode || null,
      position_sec: progress.position_sec,
    }
  }

  function paint() {
    // Preserve focus across in-place repaints (e.g. after toggling a shelf).
    const prevId = focus && document.querySelector('.focused') && document.querySelector('.focused').id
    app.innerHTML = view()
    const watch = app.querySelector('#watch')
    if (watch) watch.onclick = () => go.play(kpId, data, resumeArg())
    const wl = app.querySelector('#wl')
    if (wl) wl.onclick = () => toggle('watchlist')
    const fav = app.querySelector('#fav')
    if (fav) fav.onclick = () => toggle('favorite')

    focus = createFocus(app)
    const restore = prevId && app.querySelector('#' + prevId)
    if (restore) focus.focusEl(restore)
    else focus.focusFirst()
  }

  function toggle(kind) {
    const on = kind === 'watchlist' ? libState.in_watchlist : libState.in_favorites
    const p = on ? removeLibrary(kpId, kind) : addLibrary(libPayload(kind))
    // Optimistic flip; reconcile from the response when it lands.
    if (kind === 'watchlist') libState.in_watchlist = !on
    else libState.in_favorites = !on
    paint()
    Promise.resolve(p)
      .then((res) => { if (res && ('in_watchlist' in res)) { libState = res; paint() } })
      .catch(() => { /* revert on failure */
        if (kind === 'watchlist') libState.in_watchlist = on
        else libState.in_favorites = on
        paint()
      })
  }

  async function load() {
    try {
      data = await getMovie(kpId)
      status = 'ok'
      // Best-effort personalisation — never block the page on it.
      getLibraryState(kpId).then((s) => { if (s) { libState = s; if (app) paint() } }).catch(() => {})
      getProgressFor(kpId).then((p) => { if (p) { progress = p; if (app) paint() } }).catch(() => {})
    } catch (_) {
      status = 'error'
    }
    if (app) paint()
  }

  function render(container) {
    app = container
    paint()
    if (status === 'loading') load()
  }

  function key(name) {
    if (name === 'ENTER') { if (focus) focus.activate(); return true }
    if (name === 'LEFT' || name === 'RIGHT' || name === 'UP' || name === 'DOWN') {
      if (focus) focus.move(name)
      return true
    }
    return false
  }

  return { render, key }
}
