// Minimal screen stack. A screen is { render(container), key(name)->bool,
// dispose?() }. Screens keep their own state in a closure and repaint on
// render(), so popping back re-renders the revealed screen.

const app = document.getElementById('app')
const stack = []

function top() {
  return stack[stack.length - 1]
}

export function push(screen) {
  stack.push(screen)
  screen.render(app)
}

export function pop() {
  if (stack.length <= 1) return false
  const s = stack.pop()
  if (s.dispose) s.dispose()
  top().render(app)
  return true
}

export function reset(screen) {
  while (stack.length) {
    const s = stack.pop()
    if (s.dispose) s.dispose()
  }
  push(screen)
}

export function key(name) {
  const t = top()
  return !!(t && t.key && t.key(name))
}

export function depth() {
  return stack.length
}
