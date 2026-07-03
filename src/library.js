import { createFocus } from './nav.js'
import { getLibrary } from './api.js'
import { currentUser } from './auth.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// «Мой список»: две полки — «Буду смотреть» (watchlist) и «Избранное» (favorite).
export function createLibraryScreen() {
  let app = null
  let focus = null
  let tab = 'watchlist'
  let items = []
  let status = 'loading' // loading | ok | error

  function cardHtml(it) {
    const poster = it.poster
      ? '<img class="poster" src="' + esc(it.poster) + '" alt="">'
      : '<div class="poster placeholder">нет постера</div>'
    const meta = [it.year ? esc(it.year) : '', it.is_series ? '<span class="badge">сериал</span>' : '']
      .filter(Boolean).join(' ')
    return (
      '<div class="card focusable" data-kp="' + esc(it.kp_id) + '" tabindex="0">' + poster +
      '<div class="card-body"><div class="card-title">' + esc(it.title) + '</div>' +
      '<div class="card-meta">' + meta + '</div></div></div>'
    )
  }

  function bodyHtml() {
    if (status === 'loading') return '<div class="muted">Загрузка…</div>'
    if (status === 'error') return '<div class="note err">Не удалось загрузить список</div>'
    if (!items.length) {
      return '<div class="muted">' +
        (tab === 'watchlist' ? 'В списке «Буду смотреть» пока пусто.' : 'В избранном пока пусто.') +
        '</div>'
    }
    let h = '<div class="grid">'
    for (let i = 0; i < items.length; i++) h += cardHtml(items[i])
    return h + '</div>'
  }

  function view() {
    return (
      '<div class="screen list">' +
      '  <div class="page-title">Мой список</div>' +
      '  <div class="tabs">' +
      '    <div id="t-watch" class="tab focusable' + (tab === 'watchlist' ? ' on' : '') + '" tabindex="0">Буду смотреть</div>' +
      '    <div id="t-fav" class="tab focusable' + (tab === 'favorite' ? ' on' : '') + '" tabindex="0">Избранное</div>' +
      '  </div>' +
      '  <div id="lib-body" class="results">' + bodyHtml() + '</div>' +
      '  <div class="hint">Стрелки — навигация · <b>OK</b> — выбрать · <b>Back</b> — назад</div>' +
      '</div>'
    )
  }

  function wire() {
    app.querySelector('#t-watch').onclick = () => switchTab('watchlist')
    app.querySelector('#t-fav').onclick = () => switchTab('favorite')
    const cards = Array.prototype.slice.call(app.querySelectorAll('.card[data-kp]'))
    for (let i = 0; i < cards.length; i++) {
      cards[i].onclick = (function (kp) { return function () { go.detail(kp) } })(+cards[i].getAttribute('data-kp'))
    }
  }

  function paint() {
    app.innerHTML = view()
    wire()
    focus = createFocus(app)
    focus.focusFirst()
  }

  function repaintBody() {
    const c = app.querySelector('#lib-body')
    if (c) c.innerHTML = bodyHtml()
    // Re-mark tabs.
    const tw = app.querySelector('#t-watch'); const tf = app.querySelector('#t-fav')
    if (tw) tw.className = 'tab focusable' + (tab === 'watchlist' ? ' on' : '')
    if (tf) tf.className = 'tab focusable' + (tab === 'favorite' ? ' on' : '')
    wire()
    if (focus) focus.refresh()
  }

  function switchTab(t) {
    if (t === tab) return
    tab = t
    status = 'loading'
    items = []
    repaintBody()
    load()
  }

  async function load() {
    try {
      const res = await getLibrary(tab, 60)
      items = (res && res.items) || []
      status = 'ok'
    } catch (_) {
      if (!currentUser()) { go.login(); return }
      status = 'error'
    }
    if (app) repaintBody()
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
