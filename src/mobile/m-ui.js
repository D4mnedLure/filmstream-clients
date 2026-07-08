// Small shared UI helpers for the mobile app.

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return (h > 0 ? h + ':' + pad(m) : m) + ':' + pad(s)
}

export const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 5 7.5 12 14.5 19"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
  rw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 8.5v-4m0 4 3.2-2.6A8 8 0 1 1 4.3 13"/><text x="9" y="16.5" font-size="7.5" fill="currentColor" stroke="none" font-weight="700">10</text></svg>',
  ff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 8.5v-4m0 4-3.2-2.6A8 8 0 1 0 19.7 13"/><text x="9.5" y="16.5" font-size="7.5" fill="currentColor" stroke="none" font-weight="700">10</text></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9.5 5 16.5 12 9.5 19"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><line x1="6" y1="12" x2="15" y2="12"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-9-9c-1.2-2.7.4-6 3.6-6 2 0 3.4 1 4.4 2.6C12 6 13.4 5 15.4 5 18.6 5 20.2 8.3 19 11c-2 4.4-7 9-7 9z"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
}

// Poster card (grid or row). item: {kp_id,name/title,poster,year,is_series,progress_pct,season,episode}
export function cardHtml(it, opts) {
  opts = opts || {}
  const title = esc(it.title || it.name || '')
  const poster = it.poster
    ? '<img class="m-poster" loading="lazy" src="' + esc(it.poster) + '" alt="">'
    : '<div class="m-poster ph">нет постера</div>'
  let pbar = ''
  if (opts.progress && it.progress_pct) {
    pbar = '<div class="m-pbar"><div class="m-pbar-fill" style="width:' + it.progress_pct + '%"></div></div>'
  }
  let sub = ''
  if (opts.progress && it.is_series && it.season) sub = 'S' + it.season + 'E' + it.episode
  else if (it.year) sub = esc(it.year) + (it.is_series ? ' · сериал' : '')
  else if (it.is_series) sub = 'сериал'
  return (
    '<div class="m-card" data-kp="' + esc(it.kp_id) + '">' +
    '<div class="m-poster-wrap">' + poster + pbar + '</div>' +
    '<div class="m-card-title">' + title + '</div>' +
    (sub ? '<div class="m-card-sub">' + sub + '</div>' : '') +
    '</div>'
  )
}

export function wireCards(root, onTap) {
  const cards = Array.prototype.slice.call(root.querySelectorAll('.m-card[data-kp]'))
  for (let i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', ((kp) => () => onTap(kp))(+cards[i].getAttribute('data-kp')))
  }
}

// Bottom sheet with a list of items. items: [{label, value, on}]; onPick(value).
export function openSheet(title, items, onPick) {
  const back = document.createElement('div')
  back.className = 'sheet-back'
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  let body = ''
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    body += '<div class="sheet-item' + (it.on ? ' on' : '') + '" data-v="' + esc(it.value) + '">' + esc(it.label) + '</div>'
  }
  sheet.innerHTML =
    '<div class="sheet-grip"></div><div class="sheet-title">' + esc(title) + '</div>' +
    '<div class="sheet-body">' + body + '</div>'
  function close() {
    back.remove()
    sheet.remove()
  }
  back.addEventListener('click', close)
  const rows = sheet.querySelectorAll('.sheet-item')
  for (let i = 0; i < rows.length; i++) {
    rows[i].addEventListener('click', function () {
      const v = this.getAttribute('data-v')
      close()
      onPick(v)
    })
  }
  document.body.appendChild(back)
  document.body.appendChild(sheet)
  return close
}
