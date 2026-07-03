import { createFocus } from './nav.js'
import { currentUser, clearToken } from './auth.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function createHomeScreen() {
  let focus = null

  function render(app) {
    const u = currentUser() || { name: 'гость', sub: '', picture: '' }
    const avatar = u.picture
      ? '<img class="avatar" src="' + esc(u.picture) + '" alt="">'
      : '<div class="avatar placeholder">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>'

    app.innerHTML =
      '<div class="screen">' +
      '  <div class="logo">Film<span class="accent">Stream</span> TV</div>' +
      '  <div id="go-account" class="user-card focusable" tabindex="0">' + avatar +
      '    <div class="user-meta"><div class="user-name">' + esc(u.name) + '</div>' +
      '      <div class="user-sub">' + esc(u.sub) + '</div></div></div>' +
      '  <div id="go-search" class="btn focusable" tabindex="0">' +
      '    <svg class="btn-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
      '    Поиск фильмов</div>' +
      '  <div id="go-account-btn" class="btn ghost focusable" tabindex="0">Личный кабинет</div>' +
      '  <div id="logout" class="btn ghost focusable" tabindex="0">Выйти</div>' +
      '  <div class="hint">Пульт: <b>OK</b> — выбрать · <b>Back</b> — закрыть</div>' +
      '</div>'

    app.querySelector('#go-search').onclick = () => go.search()
    app.querySelector('#go-account').onclick = () => go.account()
    app.querySelector('#go-account-btn').onclick = () => go.account()
    app.querySelector('#logout').onclick = () => { clearToken(); go.login() }

    focus = createFocus(app)
    focus.focusFirst()
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
