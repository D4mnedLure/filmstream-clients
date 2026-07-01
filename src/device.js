import qrcode from 'qrcode-generator'
import { requestDeviceCode, pollDeviceToken } from './api.js'
import { AUTH_BASE } from './config.js'

// Renders the device-login screen into `container` and drives the poll loop.
// Calls onSuccess(jwt) once the phone approves. Returns a cancel() function.
export function renderLogin(container, onSuccess) {
  let stopped = false
  let timer = null

  function screen(inner) {
    container.innerHTML = '<div class="screen login">' + inner + '</div>'
  }

  function loading(msg) {
    screen(
      '<div class="logo">Film<span class="accent">Stream</span> TV</div>' +
        '<div class="tagline">' + (msg || 'Подготовка входа…') + '</div>'
    )
  }

  function retryLater(msg) {
    screen(
      '<div class="logo">Film<span class="accent">Stream</span> TV</div>' +
        '<div class="tagline" style="color:#f87171">' + msg + '</div>' +
        '<div class="hint">Повторная попытка через 5 c…</div>'
    )
    timer = setTimeout(start, 5000)
  }

  function showCode(data, qrHtml) {
    screen(
      '<div class="logo">Film<span class="accent">Stream</span> TV</div>' +
        '<div class="tagline">Вход с телефона</div>' +
        '<div class="login-grid">' +
        '  <div class="qr">' + qrHtml + '</div>' +
        '  <div class="login-steps">' +
        '    <div class="step"><span class="num">1</span> Отсканируйте QR или откройте</div>' +
        '    <div class="verify-uri">' + data.verification_uri + '</div>' +
        '    <div class="step"><span class="num">2</span> Введите код:</div>' +
        '    <div class="code-big">' + data.user_code + '</div>' +
        '    <div class="step"><span class="num">3</span> Войдите через Google / Яндекс</div>' +
        '  </div>' +
        '</div>' +
        '<div class="hint" id="poll-note">Ожидание подтверждения…</div>'
    )
  }

  async function start() {
    if (stopped) return
    loading()
    let data
    try {
      data = await requestDeviceCode()
    } catch (e) {
      retryLater('Не удалось связаться с сервером авторизации')
      return
    }
    if (stopped) return
    const qr = qrcode(0, 'M')
    qr.addData(data.verification_uri_complete || AUTH_BASE + '/device')
    qr.make()
    showCode(data, qr.createImgTag(6, 8))
    poll(data.device_code, Math.max(2, data.interval || 5) * 1000)
  }

  function poll(deviceCode, intervalMs) {
    if (stopped) return
    timer = setTimeout(async () => {
      if (stopped) return
      let r
      try {
        r = await pollDeviceToken(deviceCode)
      } catch (_) {
        r = { status: 'pending' } // transient network error — keep waiting
      }
      if (stopped) return
      if (r.status === 'ok') {
        onSuccess(r.token)
        return
      }
      if (r.status === 'expired') {
        start() // code expired — request a fresh one
        return
      }
      poll(deviceCode, intervalMs)
    }, intervalMs)
  }

  start()
  return function cancel() {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
