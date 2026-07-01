import { currentUser } from './auth.js'

// Placeholder home screen shown after login. The catalog (search + grid) lands
// in M5; for now it confirms the session and offers logout.
export function renderHome(container, onLogout) {
  const u = currentUser() || { name: 'гость', sub: '' }
  const avatar = u.picture
    ? '<img class="avatar" src="' + u.picture + '" alt="">'
    : '<div class="avatar placeholder">' + (u.name || '?').charAt(0).toUpperCase() + '</div>'

  container.innerHTML =
    '<div class="screen">' +
    '  <div class="logo">Film<span class="accent">Stream</span> TV</div>' +
    '  <div class="user-card">' +
    avatar +
    '    <div class="user-meta"><div class="user-name">' + u.name + '</div>' +
    '      <div class="user-sub">' + u.sub + '</div></div>' +
    '  </div>' +
    '  <div class="tagline">Вход выполнен. Каталог — в M5.</div>' +
    '  <div id="logout" class="btn focusable focused" tabindex="0">Выйти</div>' +
    '  <div class="hint">Пульт: <b>OK</b> — выйти из аккаунта · <b>Back</b> — закрыть</div>' +
    '</div>'

  const btn = document.getElementById('logout')
  if (btn) {
    btn.focus()
    btn.onclick = onLogout
  }
}
