import { createFocus } from './nav.js'
import { searchStream } from './api.js'
import { go } from './flows.js'

// Russian ЙЦУКЕН + Latin QWERTY layouts (toggleable).
const LAYOUTS = {
  ru: ['1234567890', 'ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮЁ'],
  en: ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
}

// Inline SVGs — the TV font has no ⌫ glyph (renders as tofu).
const ICON_BACK =
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><line x1="17.5" y1="9.5" x2="11.5" y2="14.5"/><line x1="11.5" y1="9.5" x2="17.5" y2="14.5"/></svg>'
const ICON_CLEAR =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
  '<line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function qsa(root, sel) {
  return Array.prototype.slice.call(root.querySelectorAll(sel))
}

export function createSearchScreen() {
  let query = ''
  let layout = 'ru'
  let results = []
  let status = 'idle' // idle | loading | empty | error
  let errorMsg = ''
  let focus = null
  let es = null
  let debounce = null
  let app = null

  function dispose() {
    if (es) { es.close(); es = null }
    if (debounce) { clearTimeout(debounce); debounce = null }
  }

  function keyboardHtml() {
    const rows = LAYOUTS[layout]
    let html = '<div class="keyboard">'
    for (let r = 0; r < rows.length; r++) {
      html += '<div class="kb-row">'
      const row = rows[r]
      for (let i = 0; i < row.length; i++) {
        const ch = row.charAt(i)
        html += '<div class="key focusable" data-key="' + ch + '">' + ch + '</div>'
      }
      html += '</div>'
    }
    const langLabel = layout === 'ru' ? 'EN' : 'РУ'
    html +=
      '<div class="kb-row">' +
      '<div class="key lang focusable" id="kb-lang" title="Сменить раскладку">' + langLabel + '</div>' +
      '<div class="key wide focusable" id="kb-space">Пробел</div>' +
      '<div class="key focusable" id="kb-back" title="Стереть">' + ICON_BACK + '</div>' +
      '<div class="key focusable" id="kb-clear" title="Очистить">' + ICON_CLEAR + '</div>' +
      '</div></div>'
    return html
  }

  function toggleLayout() {
    layout = layout === 'ru' ? 'en' : 'ru'
    const wrap = app.querySelector('.kb-wrap')
    if (!wrap) return
    wrap.innerHTML = keyboardHtml()
    wireKeyboard()
    if (focus) { focus.refresh(); focus.focusEl(app.querySelector('#kb-lang')) }
  }

  function cardHtml(it) {
    const poster = it.poster
      ? '<img class="poster" src="' + esc(it.poster) + '" alt="">'
      : '<div class="poster placeholder">нет постера</div>'
    const year = it.year ? esc(it.year) : ''
    const badge = it.is_series ? '<span class="badge">сериал</span>' : ''
    const rating = it.rating_kp ? '<span class="rating">★ ' + esc(it.rating_kp) + '</span>' : ''
    return (
      '<div class="card focusable" data-kp="' + esc(it.kp_id) + '" tabindex="0">' +
      poster +
      '<div class="card-body"><div class="card-title">' + esc(it.name) + '</div>' +
      '<div class="card-meta">' + year + ' ' + rating + ' ' + badge + '</div></div></div>'
    )
  }

  function resultsHtml() {
    if (status === 'loading') return '<div class="note">Поиск…</div>'
    if (status === 'empty') return '<div class="note">Ничего не найдено</div>'
    if (status === 'error') return '<div class="note err">' + esc(errorMsg) + '</div>'
    if (status === 'idle') return '<div class="note">Введите название (мин. 2 символа)</div>'
    let html = '<div class="grid">'
    for (let i = 0; i < results.length; i++) html += cardHtml(results[i])
    return html + '</div>'
  }

  function render(container) {
    app = container
    app.innerHTML =
      '<div class="screen search">' +
      '  <div class="search-head">' +
      '    <div class="search-label">Поиск</div>' +
      '    <div id="query" class="query">' + (esc(query) || '<span class="ph">…</span>') + '</div>' +
      '  </div>' +
      '  <div class="search-body">' +
      '    <div class="kb-wrap">' + keyboardHtml() + '</div>' +
      '    <div id="results" class="results">' + resultsHtml() + '</div>' +
      '  </div>' +
      '  <div class="hint">Стрелки — навигация · <b>OK</b> — выбрать · <b>Back</b> — назад</div>' +
      '</div>'
    wireKeyboard()
    wireResults()
    focus = createFocus(app)
    focus.focusFirst()
  }

  function wireKeyboard() {
    const keys = qsa(app, '.key[data-key]')
    for (let i = 0; i < keys.length; i++) {
      keys[i].onclick = (function (ch) { return function () { press(ch) } })(keys[i].getAttribute('data-key'))
    }
    const lang = app.querySelector('#kb-lang')
    const space = app.querySelector('#kb-space')
    const back = app.querySelector('#kb-back')
    const clr = app.querySelector('#kb-clear')
    if (lang) lang.onclick = () => toggleLayout()
    if (space) space.onclick = () => press(' ')
    if (back) back.onclick = () => { query = query.slice(0, -1); changed() }
    if (clr) clr.onclick = () => { query = ''; results = []; status = 'idle'; changed() }
  }

  function wireResults() {
    const cards = qsa(app, '.card[data-kp]')
    for (let i = 0; i < cards.length; i++) {
      cards[i].onclick = (function (kp) { return function () { go.detail(kp) } })(+cards[i].getAttribute('data-kp'))
    }
  }

  function press(ch) {
    query += ch
    changed()
  }

  function changed() {
    const q = app.querySelector('#query')
    if (q) q.innerHTML = esc(query) || '<span class="ph">…</span>'
    if (debounce) clearTimeout(debounce)
    if (query.trim().length < 2) {
      if (es) { es.close(); es = null }
      results = []
      status = 'idle'
      repaintResults()
      return
    }
    debounce = setTimeout(run, 450)
  }

  function repaintResults() {
    const c = app.querySelector('#results')
    if (!c) return
    c.innerHTML = resultsHtml()
    wireResults()
    if (focus) focus.refresh()
  }

  function run() {
    if (es) { es.close(); es = null }
    results = []
    status = 'loading'
    repaintResults()
    const q = query.trim()
    es = searchStream(q, {
      onItem: (it) => {
        if (it && it.kp_id) { results.push(it); status = 'ok'; repaintResults() }
      },
      onDone: () => {
        if (!results.length) status = 'empty'
        repaintResults()
      },
      onError: (msg) => {
        status = 'error'
        errorMsg = msg
        repaintResults()
      },
    })
  }

  function key(name) {
    if (name === 'ENTER') { focus.activate(); return true }
    if (name === 'LEFT' || name === 'RIGHT' || name === 'UP' || name === 'DOWN') {
      focus.move(name)
      return true
    }
    return false
  }

  return { render, key, dispose }
}
