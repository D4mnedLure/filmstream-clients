import './style.css'
import { initRemote, exitApp } from './remote.js'
import { checkAuth, checkFilm } from './api.js'
import { AUTH_BASE, FILM_BASE } from './config.js'

const app = document.getElementById('app')

function pill(state, text) {
  return `<span class="pill ${state}">${text}</span>`
}

function render() {
  app.innerHTML = `
    <div class="screen">
      <div class="logo">Film<span class="accent">Stream</span> TV</div>
      <div class="tagline">M3 — скелет · проверка окружения</div>

      <div class="status">
        <h2>Связь с бэкендами</h2>
        <div class="row">
          <span class="label">auth · ${AUTH_BASE}</span>
          <span class="val" id="st-auth">${pill('wait', '…')}</span>
        </div>
        <div class="row">
          <span class="label">film · ${FILM_BASE}</span>
          <span class="val" id="st-film">${pill('wait', '…')}</span>
        </div>
        <div class="row">
          <span class="label">origin приложения</span>
          <span class="val origin" id="origin">${window.location.origin || 'file://'}</span>
        </div>
      </div>

      <div id="retry" class="status focusable" tabindex="0"
           style="text-align:center;cursor:pointer;font-size:30px;font-weight:700;">
        Проверить снова
      </div>

      <div class="hint">Пульт: <b>OK</b> — обновить · <b>Back</b> — выход</div>
    </div>
  `
}

function pillFor(res) {
  if (!res.ok) return pill('bad', res.error ? 'нет связи' : 'ошибка')
  if (res.status === 401) return pill('ok', 'OK · 401 (нужен токен)')
  if (res.status) return pill('ok', 'OK · ' + res.status)
  return pill('ok', 'OK · reachable') // no-cors opaque success
}

async function runChecks() {
  const authEl = document.getElementById('st-auth')
  const filmEl = document.getElementById('st-film')
  authEl.innerHTML = pill('wait', '…')
  filmEl.innerHTML = pill('wait', '…')

  const [auth, film] = await Promise.all([checkAuth(), checkFilm()])
  authEl.innerHTML = pillFor(auth)
  filmEl.innerHTML = pillFor(film)
}

function focusRetry() {
  const el = document.getElementById('retry')
  if (el) {
    el.classList.add('focused')
    el.focus()
  }
}

function main() {
  render()
  focusRetry()
  runChecks()

  initRemote((key) => {
    switch (key) {
      case 'ENTER':
        runChecks()
        return true
      case 'BACK':
        exitApp()
        return true
      default:
        // Arrows are a no-op on this single-control screen (spatial nav → M5).
        focusRetry()
        return true
    }
  })
}

main()
