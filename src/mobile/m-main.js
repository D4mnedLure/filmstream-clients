import './m-style.css'
import { currentUser } from '../auth.js'
import { login, completeLogin } from './m-auth.js'
import { route, start, nav, onChange } from './m-router.js'
import { ICONS } from './m-ui.js'
import { createHome } from './m-home.js'
import { createSearch } from './m-search.js'
import { createDetail } from './m-detail.js'
import { createPlayer } from './m-player.js'
import { createAccount, createLibrary, createHistory, createSettings } from './m-account.js'

// ── Login landing ────────────────────────────────────────────────────────────
function createLogin() {
  function render(app) {
    app.innerHTML =
      '<div class="login-page">' +
      '  <div class="m-logo">Film<span class="a">Stream</span></div>' +
      '  <div class="login-sub">Фильмы и сериалы. Вход через Google или Яндекс.</div>' +
      '  <button id="lg-btn" class="btn">Войти</button>' +
      '</div>'
    app.querySelector('#lg-btn').addEventListener('click', login)
  }
  return { render }
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'home', hash: '#/', label: 'Главная', icon: ICONS.home },
  { id: 'search', hash: '#/search', label: 'Поиск', icon: ICONS.search },
  { id: 'account', hash: '#/account', label: 'Кабинет', icon: ICONS.user },
]
// Screens that own the full viewport (no tab bar).
const NO_TABBAR = { movie: 1, watch: 1, login: 1 }

function mountTabbar() {
  const bar = document.createElement('div')
  bar.className = 'tabbar'
  let html = ''
  for (let i = 0; i < TABS.length; i++) {
    const t = TABS[i]
    html += '<div class="tab-item" data-tab="' + t.id + '" data-hash="' + t.hash + '">' + t.icon + t.label + '</div>'
  }
  bar.innerHTML = html
  const items = bar.querySelectorAll('.tab-item')
  for (let i = 0; i < items.length; i++) {
    items[i].addEventListener('click', function () { nav(this.getAttribute('data-hash')) })
  }
  document.body.appendChild(bar)

  onChange((section) => {
    bar.style.display = NO_TABBAR[section] ? 'none' : 'flex'
    const active = section === 'home' ? 'home' : section === 'search' ? 'search' : 'account'
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('on', items[i].getAttribute('data-tab') === active)
    }
  })
}

// ── Routes ───────────────────────────────────────────────────────────────────
route('home', createHome)
route('search', createSearch)
route('movie/:id', createDetail)
route('watch/:id', createPlayer)
route('account', createAccount)
route('library', createLibrary)
route('history', createHistory)
route('settings', createSettings)

async function boot() {
  await completeLogin() // consumes ?code= from the OAuth redirect, if present
  if (!currentUser()) {
    route('login', createLogin)
    // Everything routes to login until authorized.
    const app = document.getElementById('app')
    createLogin().render(app)
    return
  }
  mountTabbar()
  start()
}

boot()
