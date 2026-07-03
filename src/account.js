import { createFocus } from './nav.js'
import { getProfile, getContinue } from './api.js'
import { currentUser, clearToken } from './auth.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Личный кабинет: профиль, статистика, «продолжить просмотр» и переходы в
// список/историю/настройки. Данные — из backend /api/me (через /tv-api).
export function createAccountScreen() {
  let app = null
  let focus = null
  let profile = null
  let cont = []
  let status = 'loading' // loading | ok | error

  function contCardHtml(it) {
    const poster = it.poster
      ? '<div class="poster-wrap"><img class="poster" src="' + esc(it.poster) + '" alt="">' +
        '<div class="pbar"><div class="pbar-fill" style="width:' + (it.progress_pct || 0) + '%"></div></div></div>'
      : '<div class="poster placeholder">нет постера</div>'
    const sub = it.is_series && it.season
      ? 'S' + esc(it.season) + 'E' + esc(it.episode) + ' · ' + (it.progress_pct || 0) + '%'
      : (it.progress_pct || 0) + '%'
    return (
      '<div class="card focusable" data-kp="' + esc(it.kp_id) + '" tabindex="0">' +
      poster +
      '<div class="card-body"><div class="card-title">' + esc(it.title) + '</div>' +
      '<div class="card-meta">▶ Продолжить · ' + sub + '</div></div></div>'
    )
  }

  function headHtml() {
    const u = profile || {}
    const avatar = u.picture
      ? '<img class="avatar" src="' + esc(u.picture) + '" alt="">'
      : '<div class="avatar placeholder">' + esc((u.display_name || '?').charAt(0).toUpperCase()) + '</div>'
    const year = u.created_at ? String(u.created_at).slice(0, 4) : ''
    const st = u.stats || { watching: 0, watchlist: 0, favorites: 0 }
    return (
      '<div class="acct-head">' + avatar +
      '  <div class="acct-id">' +
      '    <div class="acct-name">' + esc(u.display_name || 'гость') + '</div>' +
      '    <div class="acct-email">' + esc(u.email || '') + '</div>' +
      (year ? '    <div class="acct-since">' + esc(u.provider || '') + ' · с нами с ' + esc(year) + '</div>' : '') +
      '  </div>' +
      '  <div class="acct-stats">' +
      '    <div class="stat"><span class="num">' + st.watching + '</span><span class="cap">смотрю</span></div>' +
      '    <div class="stat"><span class="num">' + st.watchlist + '</span><span class="cap">в списке</span></div>' +
      '    <div class="stat"><span class="num">' + st.favorites + '</span><span class="cap">избранное</span></div>' +
      '  </div>' +
      '</div>'
    )
  }

  function contHtml() {
    if (!cont.length) return '<div class="muted">Пока ничего не начато — найдите фильм и включите просмотр.</div>'
    let h = '<div class="grid">'
    for (let i = 0; i < cont.length; i++) h += contCardHtml(cont[i])
    return h + '</div>'
  }

  function view() {
    if (status === 'error') {
      return '<div class="screen"><div class="tagline" style="color:#f87171">Не удалось загрузить кабинет</div><div class="hint">Back — назад</div></div>'
    }
    return (
      '<div class="screen account">' +
      headHtml() +
      '  <div class="acct-actions">' +
      '    <div id="go-list" class="btn ghost sm focusable" tabindex="0">★ Мой список</div>' +
      '    <div id="go-hist" class="btn ghost sm focusable" tabindex="0">История</div>' +
      '    <div id="go-set" class="btn ghost sm focusable" tabindex="0">Настройки</div>' +
      '    <div id="logout" class="btn ghost sm focusable" tabindex="0">Выйти</div>' +
      '  </div>' +
      '  <div class="section-title">Продолжить просмотр</div>' +
      (status === 'loading' ? '<div class="muted">Загрузка…</div>' : contHtml()) +
      '  <div class="hint">Стрелки — навигация · <b>OK</b> — выбрать · <b>Back</b> — назад</div>' +
      '</div>'
    )
  }

  function paint() {
    app.innerHTML = view()
    const list = app.querySelector('#go-list')
    const hist = app.querySelector('#go-hist')
    const set = app.querySelector('#go-set')
    const out = app.querySelector('#logout')
    if (list) list.onclick = () => go.library()
    if (hist) hist.onclick = () => go.history()
    if (set) set.onclick = () => go.settings()
    if (out) out.onclick = () => { clearToken(); go.login() }
    const cards = Array.prototype.slice.call(app.querySelectorAll('.card[data-kp]'))
    for (let i = 0; i < cards.length; i++) {
      cards[i].onclick = (function (kp) { return function () { go.detail(kp) } })(+cards[i].getAttribute('data-kp'))
    }
    focus = createFocus(app)
    focus.focusFirst()
  }

  async function load() {
    try {
      const [p, c] = await Promise.all([getProfile(), getContinue(18).catch(() => [])])
      profile = p
      cont = Array.isArray(c) ? c : []
      status = 'ok'
    } catch (_) {
      if (!currentUser()) { go.login(); return }
      status = 'error'
    }
    if (app) paint()
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
