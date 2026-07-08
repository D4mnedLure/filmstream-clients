import { searchStream } from '../api.js'
import { esc, cardHtml, wireCards, ICONS } from './m-ui.js'
import { nav } from './m-router.js'

// Query survives leaving the tab (standard mobile search UX).
let lastQuery = ''
let lastResults = []

export function createSearch() {
  let es = null
  let debounce = null
  let results = lastResults.slice()
  let status = results.length ? 'ok' : 'idle'
  let app = null

  function dispose() {
    if (es) { es.close(); es = null }
    if (debounce) clearTimeout(debounce)
    lastResults = results
  }

  function resultsHtml() {
    if (status === 'loading') return '<div class="spinner"></div>'
    if (status === 'empty') return '<div class="note">Ничего не найдено</div>'
    if (status === 'error') return '<div class="note err">Ошибка поиска — попробуйте ещё раз</div>'
    if (status === 'idle') return '<div class="note">Найдите фильм или сериал</div>'
    let html = '<div class="m-grid">'
    for (let i = 0; i < results.length; i++) html += cardHtml(results[i])
    return html + '</div>'
  }

  function repaint() {
    const box = app && app.querySelector('#s-results')
    if (!box) return
    box.innerHTML = resultsHtml()
    wireCards(box, (kp) => nav('#/movie/' + kp))
  }

  function run(q) {
    if (es) { es.close(); es = null }
    results = []
    status = 'loading'
    repaint()
    es = searchStream(q, {
      onItem: (it) => { if (it && it.kp_id) { results.push(it); status = 'ok'; repaint() } },
      onDone: () => { if (!results.length) status = 'empty'; repaint() },
      onError: () => { status = 'error'; repaint() },
    })
  }

  function changed(q) {
    lastQuery = q
    if (debounce) clearTimeout(debounce)
    if (q.trim().length < 2) {
      if (es) { es.close(); es = null }
      results = []
      status = 'idle'
      repaint()
      return
    }
    debounce = setTimeout(() => run(q.trim()), 400)
  }

  function render(container) {
    app = container
    app.innerHTML =
      '<div class="page">' +
      '  <div class="search-bar"><div class="search-input-wrap">' + ICONS.search +
      '    <input id="s-input" class="search-input" type="search" placeholder="Фильмы и сериалы"' +
      '      autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" value="' + esc(lastQuery) + '">' +
      '    <div id="s-clear" class="search-clear" style="display:' + (lastQuery ? 'flex' : 'none') + '">' + ICONS.close + '</div>' +
      '  </div></div>' +
      '  <div id="s-results">' + resultsHtml() + '</div>' +
      '</div>'
    const input = app.querySelector('#s-input')
    const clear = app.querySelector('#s-clear')
    input.addEventListener('input', () => {
      clear.style.display = input.value ? 'flex' : 'none'
      changed(input.value)
    })
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur() })
    clear.addEventListener('click', () => {
      input.value = ''
      clear.style.display = 'none'
      changed('')
      input.focus()
    })
    wireCards(app.querySelector('#s-results'), (kp) => nav('#/movie/' + kp))
  }

  return { render, dispose }
}
