import { getHome, getContinue, getLibrary } from '../api.js'
import { currentUser } from '../auth.js'
import { esc, cardHtml, wireCards } from './m-ui.js'
import { nav } from './m-router.js'

function rowHtml(title, items, opts) {
  if (!items || !items.length) return ''
  let cards = ''
  for (let i = 0; i < items.length; i++) cards += cardHtml(items[i], opts)
  return '<div class="row-title">' + esc(title) + '</div><div class="hscroll">' + cards + '</div>'
}

export function createHome() {
  function render(app) {
    const u = currentUser() || { name: '?' }
    const ava = u.picture
      ? '<img class="m-ava" src="' + esc(u.picture) + '" alt="">'
      : '<div class="m-ava">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>'
    app.innerHTML =
      '<div class="page">' +
      '  <div class="m-head">' +
      '    <div class="m-logo">Film<span class="a">Stream</span></div>' +
      '    <div id="h-ava">' + ava + '</div>' +
      '  </div>' +
      '  <div id="h-rows"><div class="spinner"></div></div>' +
      '</div>'
    app.querySelector('#h-ava').addEventListener('click', () => nav('#/account'))
    load(app)
  }

  async function load(app) {
    const res = await Promise.all([
      getContinue(20).catch(() => []),
      getHome().catch(() => []),
      getLibrary('favorite', 20).catch(() => ({ items: [] })),
      getLibrary('watchlist', 20).catch(() => ({ items: [] })),
    ])
    const box = app.querySelector('#h-rows')
    if (!box) return
    let html = rowHtml('Продолжить просмотр', res[0] || [], { progress: true })
    const catalog = res[1] || []
    for (let i = 0; i < catalog.length; i++) html += rowHtml(catalog[i].title, catalog[i].items)
    html += rowHtml('Избранное', (res[2] && res[2].items) || [])
    html += rowHtml('Хочу посмотреть', (res[3] && res[3].items) || [])
    box.innerHTML = html || '<div class="note">Не удалось загрузить списки. Потяните к поиску 🙂</div>'
    wireCards(box, (kp) => nav('#/movie/' + kp))
  }

  return { render }
}
