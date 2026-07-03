import { createFocus } from './nav.js'
import { getHistory } from './api.js'
import { currentUser } from './auth.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function when(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// «История просмотров»: журнал последних открытых тайтлов.
export function createHistoryScreen() {
  let app = null
  let focus = null
  let items = []
  let status = 'loading'

  function rowHtml(h) {
    const thumb = h.poster
      ? '<img class="hist-thumb" src="' + esc(h.poster) + '" alt="">'
      : '<div class="hist-thumb"></div>'
    const sub = [h.season ? 'S' + esc(h.season) + 'E' + esc(h.episode) : '', when(h.watched_at)]
      .filter(Boolean).join(' · ')
    return (
      '<div class="hist-row focusable" data-kp="' + esc(h.kp_id) + '" tabindex="0">' + thumb +
      '<div class="hist-body"><div class="hist-title">' + esc(h.title || ('#' + h.kp_id)) + '</div>' +
      '<div class="hist-sub">' + sub + '</div></div></div>'
    )
  }

  function bodyHtml() {
    if (status === 'loading') return '<div class="muted">Загрузка…</div>'
    if (status === 'error') return '<div class="note err">Не удалось загрузить историю</div>'
    if (!items.length) return '<div class="muted">История пуста.</div>'
    let h = '<div class="hist">'
    for (let i = 0; i < items.length; i++) h += rowHtml(items[i])
    return h + '</div>'
  }

  function paint() {
    app.innerHTML =
      '<div class="screen list">' +
      '  <div class="page-title">История просмотров</div>' +
      '  <div id="hist-body" class="results">' + bodyHtml() + '</div>' +
      '  <div class="hint">Стрелки — навигация · <b>OK</b> — открыть · <b>Back</b> — назад</div>' +
      '</div>'
    wire()
    focus = createFocus(app)
    focus.focusFirst()
  }

  function wire() {
    const rows = Array.prototype.slice.call(app.querySelectorAll('.hist-row[data-kp]'))
    for (let i = 0; i < rows.length; i++) {
      rows[i].onclick = (function (kp) { return function () { go.detail(kp) } })(+rows[i].getAttribute('data-kp'))
    }
  }

  async function load() {
    try {
      const res = await getHistory(50)
      items = (res && res.items) || []
      status = 'ok'
    } catch (_) {
      if (!currentUser()) { go.login(); return }
      status = 'error'
    }
    if (app) {
      const c = app.querySelector('#hist-body')
      if (c) c.innerHTML = bodyHtml()
      wire()
      if (focus) focus.refresh()
      if (focus) focus.focusFirst()
    }
  }

  function render(container) {
    app = container
    paint()
    load()
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
