if (import.meta.env.PROD) {
  const status = document.getElementById('offline-status')
  status.hidden = false

  if ('serviceWorker' in navigator) {
    status.textContent = 'Preparing offline mode…'
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    try {
      const registration = await navigator.serviceWorker.register(`${base}/sw.js`)
      if (!registration.active && registration.installing) {
        const worker = registration.installing
        await new Promise((resolve, reject) => {
          function checkState() {
            if (worker.state === 'activated' || worker.state === 'redundant') {
              worker.removeEventListener('statechange', checkState)
              if (worker.state === 'activated') resolve()
              else reject(new Error('Offline cache could not be installed'))
            }
          }
          worker.addEventListener('statechange', checkState)
          checkState()
        })
      }
      await navigator.serviceWorker.ready
      status.textContent = 'Ready offline'
    } catch {
      status.textContent = 'Offline setup failed. Reconnect and reload to try again.'
    }
  } else {
    status.textContent = 'Offline mode is unavailable in this browser.'
  }
}
