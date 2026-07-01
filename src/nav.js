// Geometry-based spatial navigation for the D-pad. Works for grids, rows and
// keyboards uniformly: on an arrow, pick the nearest `.focusable` in that
// direction (least travel + perpendicular offset).

export function createFocus(root) {
  let items = []
  let current = -1

  function refresh() {
    items = Array.prototype.slice.call(root.querySelectorAll('.focusable'))
    if (current >= items.length) current = items.length - 1
  }

  function apply(i) {
    if (current >= 0 && items[current]) items[current].classList.remove('focused')
    current = i
    const el = items[current]
    if (el) {
      el.classList.add('focused')
      if (el.scrollIntoView) el.scrollIntoView() // no-args form: Chrome 47 safe
    }
  }

  function focusFirst() {
    refresh()
    if (items.length) apply(0)
  }

  function focusEl(el) {
    refresh()
    const i = items.indexOf(el)
    if (i >= 0) apply(i)
  }

  function move(dir) {
    refresh()
    if (current < 0 || !items[current]) {
      focusFirst()
      return
    }
    const c = items[current].getBoundingClientRect()
    const cx = (c.left + c.right) / 2
    const cy = (c.top + c.bottom) / 2
    let best = -1
    let bestScore = Infinity
    for (let i = 0; i < items.length; i++) {
      if (i === current) continue
      const r = items[i].getBoundingClientRect()
      const dx = (r.left + r.right) / 2 - cx
      const dy = (r.top + r.bottom) / 2 - cy
      let ok, primary, secondary
      if (dir === 'LEFT') { ok = dx < -1; primary = -dx; secondary = Math.abs(dy) }
      else if (dir === 'RIGHT') { ok = dx > 1; primary = dx; secondary = Math.abs(dy) }
      else if (dir === 'UP') { ok = dy < -1; primary = -dy; secondary = Math.abs(dx) }
      else { ok = dy > 1; primary = dy; secondary = Math.abs(dx) }
      if (!ok) continue
      const score = primary + secondary * 2
      if (score < bestScore) { bestScore = score; best = i }
    }
    if (best >= 0) apply(best)
  }

  function activate() {
    if (current >= 0 && items[current] && items[current].click) items[current].click()
  }

  return { refresh, focusFirst, focusEl, move, activate }
}
