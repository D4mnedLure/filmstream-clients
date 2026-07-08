// Hash router: '#/movie/123?x=1' → route('movie', ['123'], {x:'1'}).
// History-backed so the iOS edge-swipe and the browser Back work naturally.

const routes = []
let currentView = null

export function route(pattern, factory) {
  routes.push({ parts: pattern.split('/').filter(Boolean), factory })
}

export function nav(hash) {
  if (location.hash === hash) render()
  else location.hash = hash
}

export function back(fallback) {
  if (history.length > 1) history.back()
  else nav(fallback || '#/')
}

function parse() {
  const raw = (location.hash || '#/').slice(1)
  const qIdx = raw.indexOf('?')
  const path = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).split('/').filter(Boolean)
  const query = {}
  if (qIdx >= 0) {
    const pairs = raw.slice(qIdx + 1).split('&')
    for (let i = 0; i < pairs.length; i++) {
      const kv = pairs[i].split('=')
      query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '')
    }
  }
  return { path, query }
}

function match(path) {
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i]
    if (r.parts.length !== path.length) continue
    const params = []
    let ok = true
    for (let j = 0; j < r.parts.length; j++) {
      if (r.parts[j].charAt(0) === ':') params.push(path[j])
      else if (r.parts[j] !== path[j]) { ok = false; break }
    }
    if (ok) return { factory: r.factory, params }
  }
  return null
}

let onChangeCb = null
export function onChange(cb) { onChangeCb = cb }

export function render() {
  const { path, query } = parse()
  const m = match(path.length ? path : ['home'])
  if (!m) { nav('#/'); return }
  if (currentView && currentView.dispose) currentView.dispose()
  const app = document.getElementById('app')
  app.innerHTML = ''
  currentView = m.factory(m.params, query) || {}
  if (currentView.render) currentView.render(app)
  window.scrollTo(0, 0)
  if (onChangeCb) onChangeCb(path[0] || 'home')
}

export function start() {
  window.addEventListener('hashchange', render)
  render()
}
