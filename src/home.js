import { createFocus } from './nav.js'
import { currentUser } from './auth.js'
import { getContinue, getLibrary, getHome } from './api.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cardHtml(it, withProgress) {
  const poster = it.poster
    ? '<img class="poster" src="' + esc(it.poster) + '" alt="">'
    : '<div class="poster placeholder">нет постера</div>'
  let pbar = ''
  if (withProgress && it.progress_pct) {
    pbar = '<div class="pbar"><div class="pbar-fill" style="width:' + it.progress_pct + '%"></div></div>'
  }
  const title = esc(it.title || it.name || '')
  let sub = ''
  if (withProgress && it.is_series && it.season) sub = 'S' + it.season + 'E' + it.episode
  else if (it.year) sub = esc(it.year)
  if (it.is_series && !sub) sub = 'сериал'
  return (
    '<div class="card focusable" data-kp="' + esc(it.kp_id) + '" tabindex="0">' +
    '<div class="poster-wrap">' + poster + pbar + '</div>' +
    '<div class="card-body"><div class="card-title">' + title + '</div>' +
    (sub ? '<div class="card-meta">' + sub + '</div>' : '') + '</div></div>'
  )
}

function rowHtml(title, items, withProgress) {
  if (!items || !items.length) return ''
  let cards = ''
  for (let i = 0; i < items.length; i++) cards += cardHtml(items[i], withProgress)
  return (
    '<div class="hrow-wrap"><div class="row-title">' + esc(title) + '</div>' +
    '<div class="hrow" data-scroll="x"><div class="hrow-inner">' + cards + '</div></div></div>'
  )
}

export function createHomeScreen() {
  let focus = null
  let app = null

  function render(container) {
    app = container
    const u = currentUser() || { name: 'гость', picture: '' }
    const avatar = u.picture
      ? '<img class="chip-av" src="' + esc(u.picture) + '" alt="">'
      : '<div class="chip-av placeholder">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>'

    app.innerHTML =
      '<div class="screen home">' +
      '  <div class="topbar">' +
      '    <div class="home-logo">Film<span class="accent">Stream</span></div>' +
      '    <div id="go-account" class="acct-chip focusable" tabindex="0">' + avatar +
      '      <span class="chip-name">' + esc(u.name) + '</span></div>' +
      '  </div>' +
      '  <div id="go-search" class="home-search focusable" tabindex="0">' +
      '    <svg class="btn-ico" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
      '    Поиск фильмов и сериалов</div>' +
      '  <div id="rows" class="home-rows" data-scroll="y"><div class="muted">Загрузка…</div></div>' +
      '</div>'

    app.querySelector('#go-account').onclick = () => go.account()
    app.querySelector('#go-search').onclick = () => go.search()

    focus = createFocus(app)
    focus.focusEl(app.querySelector('#go-search'))
    loadRows()
  }

  async function loadRows() {
    const results = await Promise.all([
      getContinue(20).catch(() => []),
      getHome().catch(() => []),
      getLibrary('favorite', 30).catch(() => ({ items: [] })),
      getLibrary('watchlist', 30).catch(() => ({ items: [] })),
    ])
    const cont = results[0] || []
    const catalog = results[1] || []
    const fav = (results[2] && results[2].items) || []
    const watch = (results[3] && results[3].items) || []

    // Personal "continue" first, then catalog rows, then library.
    let html = rowHtml('Продолжить просмотр', cont, true)
    for (let i = 0; i < catalog.length; i++) {
      html += rowHtml(catalog[i].title, catalog[i].items, false)
    }
    html += rowHtml('Избранное', fav, false)
    html += rowHtml('Хочу посмотреть', watch, false)
    if (!html) {
      html = '<div class="muted home-empty">Не удалось загрузить списки. Попробуйте поиск.</div>'
    }

    const rows = app && app.querySelector('#rows')
    if (!rows) return
    rows.innerHTML = '<div class="home-rows-inner">' + html + '</div>'
    const cards = Array.prototype.slice.call(rows.querySelectorAll('.card[data-kp]'))
    for (let i = 0; i < cards.length; i++) {
      cards[i].onclick = (function (kp) { return function () { go.detail(kp) } })(+cards[i].getAttribute('data-kp'))
    }
    if (focus) focus.refresh()
  }

  function key(name) {
    if (name === 'ENTER') { focus.activate(); return true }
    if (name === 'LEFT' || name === 'RIGHT' || name === 'UP' || name === 'DOWN') {
      focus.move(name)
      return true
    }
    return false
  }

  return { render, key }
}
