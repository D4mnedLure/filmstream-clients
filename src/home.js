import { createFocus } from './nav.js'
import { currentUser } from './auth.js'
import { getContinue, getLibrary, getHome } from './api.js'
import { go } from './flows.js'
import { checkForUpdate, installUpdate } from './update.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const ICON_BELL =
  '<svg class="bell-ico" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'

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
  let update = null // { tag, build, url } once an update is found

  // The update dialog runs its own tiny focus loop so it doesn't tangle with
  // the home grid's spatial navigation.
  let panelOpen = false
  let panelBtns = []
  let panelIdx = 0
  let installing = false

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
      '    <div class="topbar-right">' +
      '      <div id="go-update" class="bell hidden" tabindex="0" title="Доступно обновление">' +
      ICON_BELL + '<span class="bell-badge"></span></div>' +
      '      <div id="go-account" class="acct-chip focusable" tabindex="0">' + avatar +
      '        <span class="chip-name">' + esc(u.name) + '</span></div>' +
      '    </div>' +
      '  </div>' +
      '  <div id="go-search" class="home-search focusable" tabindex="0">' +
      '    <svg class="btn-ico" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
      '    Поиск фильмов и сериалов</div>' +
      '  <div id="rows" class="home-rows" data-scroll="y"><div class="muted">Загрузка…</div></div>' +
      '  <div id="update-panel" class="up-overlay hidden">' +
      '    <div class="up-dialog">' +
      '      <div class="up-title">Доступно обновление</div>' +
      '      <div id="up-ver" class="up-ver"></div>' +
      '      <div id="up-msg" class="up-msg">Скачать и установить новую версию?</div>' +
      '      <div class="up-actions">' +
      '        <div id="up-install" class="up-btn up-primary">Обновить</div>' +
      '        <div id="up-later" class="up-btn">Позже</div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>'

    app.querySelector('#go-account').onclick = () => go.account()
    app.querySelector('#go-search').onclick = () => go.search()
    app.querySelector('#go-update').onclick = () => openPanel()
    app.querySelector('#up-install').onclick = () => doInstall()
    app.querySelector('#up-later').onclick = () => closePanel()

    focus = createFocus(app)
    focus.focusEl(app.querySelector('#go-search'))
    loadRows()
    maybeShowUpdate()
  }

  async function maybeShowUpdate() {
    const info = await checkForUpdate()
    if (!info || !app) return
    update = info
    const bell = app.querySelector('#go-update')
    const ver = app.querySelector('#up-ver')
    if (ver) ver.textContent = 'Версия ' + info.tag
    if (bell) {
      // Add `focusable` only now — a hidden (display:none) focusable would sit
      // in the D-pad set with a zero-size rect and could steal focus.
      bell.classList.remove('hidden')
      bell.classList.add('focusable', 'has-update')
      if (focus) focus.refresh()
    }
  }

  function openPanel() {
    if (!update) return
    const panel = app.querySelector('#update-panel')
    panel.classList.remove('hidden')
    panelOpen = true
    installing = false
    panelBtns = [app.querySelector('#up-install'), app.querySelector('#up-later')]
    panelIdx = 0
    applyPanelFocus()
  }

  function closePanel() {
    if (installing) return
    const panel = app.querySelector('#update-panel')
    panel.classList.add('hidden')
    panelOpen = false
    for (const b of panelBtns) b && b.classList.remove('focused')
    focus.focusEl(app.querySelector('#go-update'))
  }

  function applyPanelFocus() {
    for (let i = 0; i < panelBtns.length; i++) {
      if (!panelBtns[i]) continue
      panelBtns[i].classList.toggle('focused', i === panelIdx)
    }
  }

  async function doInstall() {
    if (installing || !update) return
    installing = true
    const msg = app.querySelector('#up-msg')
    if (msg) msg.textContent = 'Загрузка обновления…'
    applyPanelFocus()
    try {
      await installUpdate(update.url)
      // Installer launched; allow dismissing the dialog again in case the user
      // cancels the system install prompt.
      installing = false
      if (msg) msg.textContent = 'Запуск установщика…'
    } catch (e) {
      installing = false
      if (msg) msg.textContent = 'Не удалось обновить. Попробуйте позже.'
    }
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

  function panelKey(name) {
    if (name === 'BACK') { closePanel(); return true }
    if (name === 'ENTER') { const b = panelBtns[panelIdx]; if (b) b.click(); return true }
    if (name === 'LEFT' || name === 'UP') { panelIdx = Math.max(0, panelIdx - 1); applyPanelFocus(); return true }
    if (name === 'RIGHT' || name === 'DOWN') { panelIdx = Math.min(panelBtns.length - 1, panelIdx + 1); applyPanelFocus(); return true }
    return true // modal: swallow everything else
  }

  function key(name) {
    if (panelOpen) return panelKey(name)
    if (name === 'ENTER') { focus.activate(); return true }
    if (name === 'LEFT' || name === 'RIGHT' || name === 'UP' || name === 'DOWN') {
      focus.move(name)
      return true
    }
    return false
  }

  return { render, key }
}
