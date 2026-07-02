import { getMovie } from './api.js'
import { createFocus } from './nav.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function createDetailScreen(kpId) {
  let data = null
  let status = 'loading' // loading | ok | error
  let focus = null
  let app = null

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
      '      <div id="watch" class="btn focusable" tabindex="0">▶ Смотреть</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="hint" id="d-hint">Пульт: <b>OK</b> — смотреть · <b>Back</b> — назад</div>' +
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

  function paint() {
    app.innerHTML = view()
    focus = createFocus(app)
    focus.focusFirst()
    const watch = app.querySelector('#watch')
    if (watch) {
      watch.onclick = () => go.play(kpId, data)
    }
  }

  async function load() {
    try {
      data = await getMovie(kpId)
      status = 'ok'
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
