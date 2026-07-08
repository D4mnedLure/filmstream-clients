import { getMovie, getProgressFor, getLibraryState, addLibrary, removeLibrary } from '../api.js'
import { esc, fmtTime, ICONS } from './m-ui.js'
import { nav, back } from './m-router.js'
import { cacheMovie } from './m-state.js'

export function createDetail(params) {
  const kpId = +params[0]
  let data = null
  let progress = null
  let lib = { favorite: false, watchlist: false }
  let app = null

  function view() {
    if (!data) return '<div class="page no-tabbar"><div class="spinner"></div></div>'
    const d = data
    const poster = d.poster
      ? '<img class="m-poster" src="' + esc(d.poster) + '" alt="">'
      : '<div class="m-poster ph">нет постера</div>'
    const meta = []
    if (d.year) meta.push(esc(d.year))
    if (d.rating_kp) meta.push('<span class="rating">★ ' + esc(Number(d.rating_kp).toFixed(1)) + '</span>')
    if (d.is_series) meta.push('сериал' + (d.seasons_count ? ' · ' + esc(d.seasons_count) + ' сез.' : ''))
    let genres = ''
    for (let i = 0; i < (d.genres || []).length; i++) genres += '<span class="chip">' + esc(d.genres[i]) + '</span>'
    let trans = ''
    for (let i = 0; i < (d.translations || []).length; i++) trans += '<span class="chip">' + esc(d.translations[i].label) + '</span>'
    const resume = progress && progress.position_sec > 30 && !progress.completed
    const watchLabel = resume ? '▶ Продолжить' : '▶ Смотреть'
    const resumeHint = resume
      ? '<div class="resume-hint">' + (d.is_series ? 'S' + progress.season + 'E' + progress.episode + ' · ' : '') + fmtTime(progress.position_sec) + '</div>'
      : ''
    return (
      '<div class="page no-tabbar">' +
      '  <div class="m-head"><div id="d-back" class="back-btn">' + ICONS.back + 'Назад</div></div>' +
      '  <div class="d-hero">' + poster +
      '    <div class="d-hero-info">' +
      '      <div class="d-name">' + esc(d.name) + '</div>' +
      (d.original_name ? '<div class="d-orig">' + esc(d.original_name) + '</div>' : '') +
      '      <div class="d-meta">' + meta.join(' · ') + '</div>' +
      '      <div class="d-genres">' + genres + '</div>' +
      resumeHint +
      '    </div>' +
      '  </div>' +
      '  <div class="d-actions">' +
      '    <button id="d-watch" class="btn">' + watchLabel + '</button>' +
      '    <button id="d-fav" class="btn secondary' + (lib.favorite ? ' on' : '') + '">♥</button>' +
      '    <button id="d-wl" class="btn secondary' + (lib.watchlist ? ' on' : '') + '">＋</button>' +
      '  </div>' +
      (d.synopsis
        ? '<div id="d-syn" class="d-syn clamp">' + esc(d.synopsis) + '</div><div id="d-more" class="d-more">ещё</div>'
        : '') +
      ((d.directors || []).length ? '<div class="d-sec">Режиссёр: ' + esc(d.directors.join(', ')) + '</div>' : '') +
      (trans ? '<div class="d-sec">Озвучки</div><div>' + trans + '</div>' : '') +
      '</div>'
    )
  }

  function paint() {
    app.innerHTML = view()
    const b = app.querySelector('#d-back')
    if (b) b.addEventListener('click', () => back('#/'))
    const w = app.querySelector('#d-watch')
    if (w) {
      w.addEventListener('click', () => {
        let q = ''
        if (progress && progress.position_sec > 30 && !progress.completed) {
          q = '?tr=' + (progress.translation || 0) +
            (data.is_series ? '&s=' + progress.season + '&e=' + progress.episode : '') +
            '&t=' + progress.position_sec
        }
        nav('#/watch/' + kpId + q)
      })
    }
    const more = app.querySelector('#d-more')
    if (more) {
      more.addEventListener('click', () => {
        app.querySelector('#d-syn').classList.remove('clamp')
        more.style.display = 'none'
      })
    }
    wireToggle('#d-fav', 'favorite')
    wireToggle('#d-wl', 'watchlist')
  }

  function wireToggle(sel, status) {
    const btn = app.querySelector(sel)
    if (!btn) return
    btn.addEventListener('click', async () => {
      const on = !lib[status]
      lib[status] = on
      btn.classList.toggle('on', on)
      try {
        if (on) {
          await addLibrary({
            kp_id: kpId, status: status, title: data.name, poster: data.poster,
            is_series: data.is_series, year: data.year,
          })
        } else {
          await removeLibrary(kpId, status)
        }
      } catch (_) {
        lib[status] = !on
        btn.classList.toggle('on', !on)
      }
    })
  }

  async function load() {
    try {
      const res = await Promise.all([
        getMovie(kpId),
        getProgressFor(kpId).catch(() => null),
        getLibraryState(kpId).catch(() => null),
      ])
      data = res[0]
      progress = res[1]
      if (res[2]) lib = { favorite: !!res[2].favorite, watchlist: !!res[2].watchlist }
      cacheMovie(kpId, data)
    } catch (_) {
      if (app) {
        app.innerHTML = '<div class="page no-tabbar"><div class="m-head"><div id="d-back" class="back-btn">' +
          ICONS.back + 'Назад</div></div><div class="note err">Не удалось загрузить фильм</div></div>'
        app.querySelector('#d-back').addEventListener('click', () => back('#/'))
      }
      return
    }
    if (app) paint()
  }

  function render(container) {
    app = container
    app.innerHTML = view()
    load()
  }

  return { render }
}
