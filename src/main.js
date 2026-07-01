import './style.css'
import { initRemote, exitApp } from './remote.js'
import { currentUser, setToken, clearToken } from './auth.js'
import { renderLogin } from './device.js'
import { renderHome } from './home.js'

const app = document.getElementById('app')
let cancelLogin = null

function stopLogin() {
  if (cancelLogin) {
    cancelLogin()
    cancelLogin = null
  }
}

function showLogin() {
  stopLogin()
  cancelLogin = renderLogin(app, (token) => {
    setToken(token)
    showHome()
  })
}

function showHome() {
  stopLogin()
  renderHome(app, () => {
    clearToken()
    showLogin()
  })
}

function route() {
  if (currentUser()) showHome()
  else showLogin()
}

initRemote((key) => {
  if (key === 'BACK') {
    exitApp()
    return true
  }
  if (key === 'ENTER') {
    const el = document.querySelector('.focusable.focused')
    if (el && el.click) el.click()
    return true
  }
  return false
})

route()
