// Geometry-based spatial navigation for the D-pad. Works for grids, rows and
// keyboards uniformly: on an arrow, pick the nearest `.focusable` in that
// direction (least travel + perpendicular offset).
//
// Chromium 47 (Tizen 3.0) has no smooth `scrollIntoView`/`scroll-behavior`, and
// the no-arg scrollIntoView snaps the element to the container edge (jarring).
// So we scroll the containers ourselves: only when the focused element nears an
// edge (with padding), animated via requestAnimationFrame.

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function now() { return (window.performance && performance.now) ? performance.now() : Date.now() }

function animateScroll(node, prop, to, dur) {
  to = Math.max(0, Math.round(to))
  const from = node[prop]
  if (Math.abs(to - from) < 2) { node[prop] = to; return }
  const key = prop === 'scrollTop' ? '_navAY' : '_navAX'
  if (node[key]) cancelAnimationFrame(node[key])
  const start = now()
  function step() {
    const t = Math.min(1, (now() - start) / dur)
    node[prop] = from + (to - from) * easeOutCubic(t)
    node[key] = t < 1 ? requestAnimationFrame(step) : 0
  }
  node[key] = requestAnimationFrame(step)
}

const PAD_Y = 100
const PAD_X = 160
const DUR = 200

function setTrack(track) {
  track.style.transform = 'translate(' + (track._navTx || 0) + 'px,' + (track._navTy || 0) + 'px)'
}

// Preferred scroller for the TV: move the inner track with a CSS-transitioned
// transform (GPU-composited, smooth on weak TV hardware) instead of scrolling
// an overflow container (per-frame repaints stutter). Container has
// data-scroll="y"|"x"; its first child is the track.
function transformScroll(node, el) {
  const track = node.firstElementChild
  if (!track) return
  const axis = node.getAttribute('data-scroll')
  const er = el.getBoundingClientRect()
  const nr = node.getBoundingClientRect()
  if (axis === 'y') {
    let ty = track._navTy || 0
    if (er.top < nr.top + PAD_Y) ty += (nr.top + PAD_Y) - er.top
    else if (er.bottom > nr.bottom - PAD_Y) ty -= er.bottom - (nr.bottom - PAD_Y)
    const min = Math.min(0, node.clientHeight - track.scrollHeight)
    track._navTy = Math.max(min, Math.min(0, ty))
  } else {
    let tx = track._navTx || 0
    if (er.left < nr.left + PAD_X) tx += (nr.left + PAD_X) - er.left
    else if (er.right > nr.right - PAD_X) tx -= er.right - (nr.right - PAD_X)
    const min = Math.min(0, node.clientWidth - track.scrollWidth)
    track._navTx = Math.max(min, Math.min(0, tx))
  }
  setTrack(track)
}

// Keep `el` inside a comfortable margin of each scroll ancestor. Prefers the
// transform track (data-scroll); falls back to animated scrollTop/Left.
function ensureVisible(el) {
  let node = el.parentNode
  while (node && node.nodeType === 1 && node !== document.body) {
    if (node.getAttribute && node.getAttribute('data-scroll')) {
      transformScroll(node, el)
      node = node.parentNode
      continue
    }
    const cs = window.getComputedStyle(node)
    const canY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && node.scrollHeight - node.clientHeight > 4
    const canX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && node.scrollWidth - node.clientWidth > 4
    if (canY || canX) {
      const er = el.getBoundingClientRect()
      const nr = node.getBoundingClientRect()
      if (canY) {
        if (er.top < nr.top + PAD_Y) animateScroll(node, 'scrollTop', node.scrollTop - (nr.top + PAD_Y - er.top), DUR)
        else if (er.bottom > nr.bottom - PAD_Y) animateScroll(node, 'scrollTop', node.scrollTop + (er.bottom - (nr.bottom - PAD_Y)), DUR)
      }
      if (canX) {
        if (er.left < nr.left + PAD_X) animateScroll(node, 'scrollLeft', node.scrollLeft - (nr.left + PAD_X - er.left), DUR)
        else if (er.right > nr.right - PAD_X) animateScroll(node, 'scrollLeft', node.scrollLeft + (er.right - (nr.right - PAD_X)), DUR)
      }
    }
    node = node.parentNode
  }
}

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
      ensureVisible(el)
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
