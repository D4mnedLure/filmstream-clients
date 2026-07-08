import { getProfile, getContinue, getLibrary, getHistory, getSettings, putSettings } from '../api.js'
import { currentUser, clearToken } from '../auth.js'
import { esc, fmtTime, cardHtml, wireCards, ICONS } from './m-ui.js'
import { nav, back } from './m-router.js'

function subHead(title) {
  return '<div class="m-head"><div class="back-btn" data-back>' + ICONS.back + esc(title) + '</div></div>'
}
function wireBack(app) {
  const b = app.querySelector('[data-back]')
  if (b) b.addEventListener('click', () => back('#/account'))
}

// ── Профиль ───────────────────────────────────────────────────────────────
export function createAccount() {
  function render(app) {
    const u = currentUser() || { name: '?', sub: '' }
    const ava = u.picture
      ? '<img class="m-ava" src="' + esc(u.picture) + '" alt="">'
      : '<div class="m-ava">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>'
    app.innerHTML =
      '<div class="page">' +
      '  <div class="m-head"><div class="m-logo">Кабинет</div></div>' +
      '  <div class="acct-card">' + ava +
      '    <div class="acct-info"><div class="acct-nm">' + esc(u.name) + '</div>' +
      '      <div class="acct-em">' + esc(u.sub) + '</div></div></div>' +
      '  <div class="stats" id="a-stats"></div>' +
      '  <div class="menu">' +
      '    <div class="menu-item" data-to="#/library">' + ICONS.heart + 'Моя библиотека<span class="chev">' + ICONS.chev + '</span></div>' +
      '    <div class="menu-item" data-to="#/history">' + ICONS.clock + 'История<span class="chev">' + ICONS.chev + '</span></div>' +
      '    <div class="menu-item" data-to="#/settings">' + ICONS.gear + 'Настройки<span class="chev">' + ICONS.chev + '</span></div>' +
      '    <div class="menu-item danger" id="a-logout">' + ICONS.logout + 'Выйти</div>' +
      '  </div>' +
      '  <div id="a-cont"></div>' +
      '</div>'
    const items = app.querySelectorAll('[data-to]')
    for (let i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () { nav(this.getAttribute('data-to')) })
    }
    app.querySelector('#a-logout').addEventListener('click', () => {
      clearToken()
      location.reload()
    })
    load(app)
  }

  async function load(app) {
    try {
      const p = await getProfile()
      const st = (p && p.stats) || {}
      const box = app.querySelector('#a-stats')
      if (box) {
        box.innerHTML =
          '<div class="stat"><b>' + (st.watching || 0) + '</b><span>смотрю</span></div>' +
          '<div class="stat"><b>' + (st.watchlist || 0) + '</b><span>в списке</span></div>' +
          '<div class="stat"><b>' + (st.favorites || 0) + '</b><span>избранное</span></div>'
      }
      // Профиль из БД точнее, чем полезная нагрузка JWT.
      const nm = app.querySelector('.acct-nm')
      const em = app.querySelector('.acct-em')
      if (p && nm) nm.textContent = p.display_name || nm.textContent
      if (p && em) em.textContent = p.email || em.textContent
      if (p && p.picture) {
        const avBox = app.querySelector('.acct-card')
        const av = avBox && avBox.querySelector('.m-ava')
        if (av && av.tagName !== 'IMG') {
          av.outerHTML = '<img class="m-ava" style="width:56px;height:56px" src="' + esc(p.picture) + '" alt="">'
        }
      }
    } catch (_) {}
    try {
      const cont = await getContinue(12)
      const box = app.querySelector('#a-cont')
      if (box && cont && cont.length) {
        let cards = ''
        for (let i = 0; i < cont.length; i++) cards += cardHtml(cont[i], { progress: true })
        box.innerHTML = '<div class="row-title">Продолжить просмотр</div><div class="hscroll">' + cards + '</div>'
        wireCards(box, (kp) => nav('#/movie/' + kp))
      }
    } catch (_) {}
  }

  return { render }
}

// ── Библиотека ────────────────────────────────────────────────────────────
export function createLibrary() {
  let status = 'favorite'
  let app = null

  function render(container) {
    app = container
    app.innerHTML =
      '<div class="page">' + subHead('Библиотека') +
      '  <div class="seg">' +
      '    <div class="seg-item on" data-s="favorite">Избранное</div>' +
      '    <div class="seg-item" data-s="watchlist">Хочу посмотреть</div>' +
      '  </div>' +
      '  <div id="l-grid"><div class="spinner"></div></div>' +
      '</div>'
    wireBack(app)
    const segs = app.querySelectorAll('.seg-item')
    for (let i = 0; i < segs.length; i++) {
      segs[i].addEventListener('click', function () {
        for (let j = 0; j < segs.length; j++) segs[j].classList.remove('on')
        this.classList.add('on')
        status = this.getAttribute('data-s')
        load()
      })
    }
    load()
  }

  async function load() {
    const box = app.querySelector('#l-grid')
    box.innerHTML = '<div class="spinner"></div>'
    try {
      const res = await getLibrary(status, 60)
      const items = (res && res.items) || []
      if (!items.length) { box.innerHTML = '<div class="note">Пока пусто</div>'; return }
      let html = '<div class="m-grid">'
      for (let i = 0; i < items.length; i++) html += cardHtml(items[i])
      box.innerHTML = html + '</div>'
      wireCards(box, (kp) => nav('#/movie/' + kp))
    } catch (_) {
      box.innerHTML = '<div class="note err">Не удалось загрузить</div>'
    }
  }

  return { render }
}

// ── История ───────────────────────────────────────────────────────────────
export function createHistory() {
  function render(app) {
    app.innerHTML = '<div class="page">' + subHead('История') + '<div id="h-list"><div class="spinner"></div></div></div>'
    wireBack(app)
    load(app)
  }

  async function load(app) {
    const box = app.querySelector('#h-list')
    try {
      const res = await getHistory(50)
      const items = (res && res.items) || []
      if (!items.length) { box.innerHTML = '<div class="note">История пуста</div>'; return }
      let html = ''
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const thumb = it.poster
          ? '<img class="h-thumb" loading="lazy" src="' + esc(it.poster) + '" alt="">'
          : '<div class="h-thumb"></div>'
        const ep = it.is_series && it.season ? 'S' + it.season + 'E' + it.episode + ' · ' : ''
        const pos = it.position_sec ? fmtTime(it.position_sec) : ''
        html += '<div class="h-row" data-kp="' + esc(it.kp_id) + '">' + thumb +
          '<div class="h-body"><div class="h-title">' + esc(it.title || '') + '</div>' +
          '<div class="h-sub">' + ep + pos + '</div></div></div>'
      }
      box.innerHTML = html
      const rows = box.querySelectorAll('.h-row')
      for (let i = 0; i < rows.length; i++) {
        rows[i].addEventListener('click', function () { nav('#/movie/' + this.getAttribute('data-kp')) })
      }
    } catch (_) {
      box.innerHTML = '<div class="note err">Не удалось загрузить</div>'
    }
  }

  return { render }
}

// ── Настройки ─────────────────────────────────────────────────────────────
const SETTING_ROWS = [
  { key: 'default_quality', name: 'Качество по умолчанию', opts: ['auto', '2160', '1440', '1080', '720', '480', '360'], labels: ['Авто', '4K', '1440p', '1080p', '720p', '480p', '360p'] },
  { key: 'autoplay_next', name: 'Автовоспроизведение след. серии', opts: [true, false], labels: ['Вкл', 'Выкл'] },
  { key: 'notify_new_episodes', name: 'Уведомления о новых сериях', opts: [true, false], labels: ['Вкл', 'Выкл'] },
]

export function createSettings() {
  let values = {}
  let app = null

  function paint() {
    let html = '<div class="page">' + subHead('Настройки')
    for (let i = 0; i < SETTING_ROWS.length; i++) {
      const row = SETTING_ROWS[i]
      html += '<div class="set-block"><div class="set-name">' + esc(row.name) + '</div><div>'
      for (let j = 0; j < row.opts.length; j++) {
        const on = String(values[row.key]) === String(row.opts[j])
        html += '<span class="chip' + (on ? ' on' : '') + '" data-k="' + row.key + '" data-v="' + row.opts[j] + '">' + esc(row.labels[j]) + '</span>'
      }
      html += '</div></div>'
    }
    app.innerHTML = html + '</div>'
    wireBack(app)
    const chips = app.querySelectorAll('.chip[data-k]')
    for (let i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', async function () {
        const k = this.getAttribute('data-k')
        let v = this.getAttribute('data-v')
        if (v === 'true') v = true
        else if (v === 'false') v = false
        values[k] = v
        paint()
        try { await putSettings(values) } catch (_) {}
      })
    }
  }

  function render(container) {
    app = container
    app.innerHTML = '<div class="page">' + subHead('Настройки') + '<div class="spinner"></div></div>'
    wireBack(app)
    getSettings()
      .then((s) => { values = s || {}; paint() })
      .catch(() => { values = {}; paint() })
  }

  return { render }
}
