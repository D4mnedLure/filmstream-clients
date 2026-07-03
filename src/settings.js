import { createFocus } from './nav.js'
import { getSettings, putSettings } from './api.js'
import { currentUser } from './auth.js'
import { go } from './flows.js'

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const QUALITIES = ['auto', '2160', '1440', '1080', '720', '480', '360']
const QLABEL = { auto: 'Авто', 2160: '4K', 1440: '1440p', 1080: '1080p', 720: '720p', 480: '480p', 360: '360p' }

// «Настройки»: качество по умолчанию, автоплей след. серии, уведомления.
// Пишет в общий backend (/api/me/settings) — синхронно с веб-кабинетом.
export function createSettingsScreen() {
  let app = null
  let focus = null
  let s = null
  let status = 'loading'

  function chip(field, value, label, on) {
    return '<div class="chip focusable' + (on ? ' on' : '') + '" data-field="' + field +
      '" data-value="' + esc(value) + '" tabindex="0">' + esc(label) + '</div>'
  }

  function rowsHtml() {
    const q = s.default_quality || '1080'
    const qChips = QUALITIES.map((v) => chip('default_quality', v, QLABEL[v] || v, String(q) === String(v))).join('')
    const autoOn = s.autoplay_next !== false
    const notifyOn = s.notify_new_episodes !== false
    return (
      '<div class="set">' +
      '  <div class="set-row"><div class="set-label">Качество по умолчанию</div>' +
      '    <div class="set-opts">' + qChips + '</div></div>' +
      '  <div class="set-row"><div class="set-label">Автовоспроизведение след. серии</div>' +
      '    <div class="set-opts">' +
      chip('autoplay_next', 'true', 'Вкл', autoOn) + chip('autoplay_next', 'false', 'Выкл', !autoOn) +
      '    </div></div>' +
      '  <div class="set-row"><div class="set-label">Уведомления о новых сериях</div>' +
      '    <div class="set-opts">' +
      chip('notify_new_episodes', 'true', 'Вкл', notifyOn) + chip('notify_new_episodes', 'false', 'Выкл', !notifyOn) +
      '    </div></div>' +
      '</div>'
    )
  }

  function bodyHtml() {
    if (status === 'loading') return '<div class="muted">Загрузка…</div>'
    if (status === 'error') return '<div class="note err">Не удалось загрузить настройки</div>'
    return rowsHtml()
  }

  function paint() {
    app.innerHTML =
      '<div class="screen list">' +
      '  <div class="page-title">Настройки</div>' +
      '  <div id="set-body" class="results">' + bodyHtml() + '</div>' +
      '  <div class="hint">Стрелки — навигация · <b>OK</b> — изменить · <b>Back</b> — назад</div>' +
      '</div>'
    wire()
    focus = createFocus(app)
    focus.focusFirst()
  }

  function repaint() {
    const c = app.querySelector('#set-body')
    if (c) c.innerHTML = bodyHtml()
    wire()
    if (focus) focus.refresh()
  }

  function wire() {
    const chips = Array.prototype.slice.call(app.querySelectorAll('.chip[data-field]'))
    for (let i = 0; i < chips.length; i++) {
      chips[i].onclick = (function (el) {
        return function () {
          const field = el.getAttribute('data-field')
          let value = el.getAttribute('data-value')
          if (value === 'true') value = true
          else if (value === 'false') value = false
          apply(field, value)
        }
      })(chips[i])
    }
  }

  function apply(field, value) {
    s[field] = value
    repaint()
    putSettings({ [field]: value }).catch(() => {})
  }

  async function load() {
    try {
      s = await getSettings()
      status = 'ok'
    } catch (_) {
      if (!currentUser()) { go.login(); return }
      status = 'error'
    }
    if (app) repaint()
  }

  function render(container) {
    app = container
    s = {}
    paint()
    load()
  }

  function key(name) {
    if (name === 'ENTER') { if (focus) focus.activate(); return true }
    if (name === 'LEFT' || name === 'RIGHT' || name === 'UP' || name === 'DOWN') {
      if (focus) focus.move(name)
      return true
    }
    return false
  }

  return { render, key }
}
