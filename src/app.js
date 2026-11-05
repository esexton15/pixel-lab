import { customChannelRules, filters, filterImage } from './filters.js'

const byId = (id) => document.getElementById(id)
const before = byId('before')
const after = byId('after')
const beforeContext = before.getContext('2d')
const afterContext = after.getContext('2d')
const sourceCanvas = document.createElement('canvas')
const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
const video = document.createElement('video')
video.muted = true
video.playsInline = true

let filter = filters[0]
let original
let result
let selectedX = 0.75
let selectedY = 0.22
let stream
let animation
let request = 0
let frozen = false

const idleDelay = 60_000
const previewDelay = 5_000
let exploring = false
let idleTimer
let previewTimer

const sampleButtons = [...document.querySelectorAll('button[data-sample]')]
const sourceButtons = [...sampleButtons, byId('camera')]
const channels = [
  { label: 'Red', color: 'bg-red-500' },
  { label: 'Green', color: 'bg-green-500' },
  { label: 'Blue', color: 'bg-blue-500' },
]
const gridRadius = 3
const cellSize = 16
const gridSize = (2 * gridRadius + 1) * cellSize

const imageCanvases = [before, after]
const readouts = imageCanvases.map((canvas, index) => {
  const panel = document.createElement('div')
  panel.className = 'pointer-events-none absolute z-10 w-40 max-w-full sm:w-52 rounded-md border bg-background p-2 shadow-sm'
  panel.hidden = true
  canvas.parentElement.append(panel)
  panel.innerHTML = `<div class="mb-1 flex items-center gap-2">
      <h3 class="text-sm font-medium">${index === 0 ? 'Input pixel' : 'Output pixel'}</h3>
      <span class="swatch size-3 rounded-sm border" aria-hidden="true"></span>
    </div>
    <p class="pixel-coordinates mb-2 font-mono text-xs text-muted-foreground"></p>
    <div class="flex items-center gap-2">
      <canvas class="pixel-grid w-12 shrink-0 border sm:w-20" width="${gridSize}" height="${gridSize}"
        role="img" aria-label="Zoomed pixel grid with the selected pixel outlined in the center"></canvas>
      <div class="min-w-0 flex-1 space-y-1">
        ${channels.map(({ label, color }) => `
          <div class="grid grid-cols-[1ch_minmax(0,1fr)_3ch] items-center gap-2 text-xs">
            <span aria-label="${label}">${label[0]}</span>
            <div class="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div class="channel-fill h-full w-0 ${color}"></div>
            </div>
            <span class="channel-value text-right font-mono"></span>
          </div>`).join('')}
      </div>
    </div>`
  return {
    grid: panel.querySelector('.pixel-grid').getContext('2d'),
    panel,
    coordinates: panel.querySelector('.pixel-coordinates'),
    swatch: panel.querySelector('.swatch'),
    fills: panel.querySelectorAll('.channel-fill'),
    values: panel.querySelectorAll('.channel-value'),
  }
})

const customButton = byId('custom-filter')
const customControls = byId('custom-controls')
const channelSelects = [...customControls.querySelectorAll('select')]
const presetButtons = [...byId('filters').children].filter((button) => button !== customButton)
presetButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectFilter(filters[index]))
})
customButton.addEventListener('click', updateCustomFilter)
for (const select of channelSelects) select.addEventListener('change', updateCustomFilter)

function updateCustomFilter() {
  const [red, green, blue] = channelSelects.map((select) => customChannelRules[Number(select.value)])
  selectFilter({
    label: 'Custom',
    description: 'Choose a rule for each output channel.',
    code: `(r, g, b) => [${red.code}, ${green.code}, ${blue.code}]`,
    apply: (r, g, b) => [red.apply(r, g, b), green.apply(r, g, b), blue.apply(r, g, b)],
  })
}

function selectFilter(item) {
  filter = item
  byId('preview-filter').textContent = item.label
  const isCustom = item.label === 'Custom'
  customControls.hidden = !isCustom
  customButton.setAttribute('aria-pressed', String(isCustom))
  byId('description').textContent = item.description
  byId('code').textContent = item.code ?? item.apply.toString().replace(/^ {4}/gm, '')
  presetButtons.forEach((button, index) => {
    button.setAttribute('aria-pressed', String(filters[index] === item))
  })
  applyFilter()
}

function selectSource(id) {
  for (const button of sourceButtons) button.setAttribute('aria-pressed', String(button.id === id))
}

function showStatus(message = '') {
  byId('status').textContent = message
  byId('status').hidden = !message
}

function capture(media, width, height) {
  const scale = Math.min(1, 640 / width, 480 / height)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  if (sourceCanvas.width !== w || sourceCanvas.height !== h || !result) {
    sourceCanvas.width = before.width = after.width = w
    sourceCanvas.height = before.height = after.height = h
    for (const canvas of imageCanvases) canvas.style.setProperty('--image-ratio', w / h)
    result = afterContext.createImageData(w, h)
  }
  sourceContext.fillStyle = '#ffffff'
  sourceContext.fillRect(0, 0, w, h)
  sourceContext.drawImage(media, 0, 0, w, h)
  original = sourceContext.getImageData(0, 0, w, h)
  applyFilter()
}

function applyFilter() {
  if (!original) return
  filterImage(original.data, result.data, filter, original.width, original.height)
  draw()
}

function draw() {
  if (!original) return
  const { width, height } = original
  const x = Math.min(width - 1, Math.floor(selectedX * width))
  const y = Math.min(height - 1, Math.floor(selectedY * height))
  beforeContext.putImageData(original, 0, 0)
  afterContext.putImageData(result, 0, 0)

  for (const context of [beforeContext, afterContext]) {
    context.strokeStyle = '#111'
    context.lineWidth = 5
    context.strokeRect(x - 6, y - 6, 13, 13)
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(x - 6, y - 6, 13, 13)
  }
  const coordinates = `Col ${x + 1} · Row ${y + 1}`
  const offset = (y * width + x) * 4
  for (const [index, image] of [original, result].entries()) {
    const rgb = image.data.subarray(offset, offset + 3)
    const readout = readouts[index]
    if (readout.panel.hidden) continue
    readout.coordinates.textContent = coordinates
    drawPixelGrid(readout.grid, image, x, y)
    readout.swatch.style.background = `rgb(${rgb.join(',')})`
    positionMagnifier(readout.panel, imageCanvases[index], x, y)
    rgb.forEach((value, channel) => {
      readout.fills[channel].style.width = `${value / 255 * 100}%`
      readout.values[channel].textContent = value
    })
  }
}

function drawPixelGrid(context, image, centerX, centerY) {
  const { data, width, height } = image
  context.fillStyle = '#d4d4d4'
  context.fillRect(0, 0, gridSize, gridSize)

  for (let dy = -gridRadius; dy <= gridRadius; dy++) {
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      if (x < 0 || x >= width || y < 0 || y >= height) continue

      const offset = (y * width + x) * 4
      context.fillStyle = `rgb(${data[offset]}, ${data[offset + 1]}, ${data[offset + 2]})`
      context.fillRect((dx + gridRadius) * cellSize, (dy + gridRadius) * cellSize, cellSize - 1, cellSize - 1)
    }
  }

  const center = gridRadius * cellSize
  context.strokeStyle = '#111'
  context.lineWidth = 4
  context.strokeRect(center, center, cellSize - 1, cellSize - 1)
  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.strokeRect(center, center, cellSize - 1, cellSize - 1)
}

function positionMagnifier(preview, canvas, x, y) {
  const frame = canvas.parentElement
  const cursorX = canvas.offsetLeft + (x + 0.5) / canvas.width * canvas.clientWidth
  const cursorY = canvas.offsetTop + (y + 0.5) / canvas.height * canvas.clientHeight
  const gap = 10
  const maxLeft = frame.clientWidth - preview.offsetWidth
  const maxTop = frame.clientHeight - preview.offsetHeight
  const right = cursorX + gap
  const left = cursorX - gap - preview.offsetWidth
  const below = cursorY + gap
  const above = cursorY - gap - preview.offsetHeight
  const fitsBeside = right <= maxLeft || left >= 0
  const popupX = right <= maxLeft ? right : left
  const popupY = fitsBeside ? cursorY - preview.offsetHeight / 2 : (below <= maxTop ? below : above)
  preview.style.left = `${Math.max(0, Math.min(maxLeft, popupX))}px`
  preview.style.top = `${Math.max(0, Math.min(maxTop, popupY))}px`
}

function showMagnifiers(visible) {
  for (const { panel } of readouts) panel.hidden = exploring && !visible
}

const clamp = (value) => Math.min(0.999999, Math.max(0, value))
for (const canvas of imageCanvases) {
  const inspect = (event) => {
    if (!exploring || !original) return
    showMagnifiers(true)
    const bounds = canvas.getBoundingClientRect()
    selectedX = clamp((event.clientX - bounds.left) / bounds.width)
    selectedY = clamp((event.clientY - bounds.top) / bounds.height)
    draw()
  }
  canvas.addEventListener('pointermove', inspect)
  canvas.addEventListener('pointerdown', inspect)
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') showMagnifiers(false)
  })
  canvas.addEventListener('blur', () => showMagnifiers(false))
  canvas.addEventListener('keydown', (event) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!exploring || !delta || !original) return
    event.preventDefault()
    showMagnifiers(true)
    const [dx, dy] = delta
    selectedX = clamp((Math.floor(selectedX * original.width) + dx + 0.5) / original.width)
    selectedY = clamp((Math.floor(selectedY * original.height) + dy + 0.5) / original.height)
    draw()
  })
}

document.addEventListener('pointerdown', (event) => {
  if (!imageCanvases.includes(event.target)) showMagnifiers(false)
})

function stopCamera() {
  cancelAnimationFrame(animation)
  stream?.getTracks().forEach((track) => track.stop())
  stream = undefined
  video.srcObject = null
  frozen = false
  byId('freeze').hidden = true
}

async function showImage(url, id) {
  const current = ++request
  showStatus()
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (current !== request) return
    stopCamera()
    capture(image, image.naturalWidth, image.naturalHeight)
    selectSource(id)
  } catch {
    if (current === request) showStatus('Could not load that sample. Try another one.')
  }
}

let lastFrame = 0
function liveFrame(time) {
  if (!stream || frozen) return
  if (time - lastFrame >= 65 && video.readyState >= 2) {
    lastFrame = time
    capture(video, video.videoWidth, video.videoHeight)
  }
  animation = requestAnimationFrame(liveFrame)
}

for (const button of sampleButtons) {
  button.addEventListener('click', () => showImage(button.dataset.sample, button.id))
}
byId('camera').addEventListener('click', async () => {
  if (stream) return
  const current = ++request
  showStatus('Waiting for camera permission…')
  try {
    const opened = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    if (current !== request) {
      opened.getTracks().forEach((track) => track.stop())
      return
    }
    stream = opened
    video.srcObject = stream
    await video.play()
    if (current !== request) {
      if (stream === opened) stopCamera()
      return
    }
    selectSource('camera')
    showStatus()
    byId('freeze').hidden = false
    byId('freeze').textContent = 'Freeze'
    animation = requestAnimationFrame(liveFrame)
  } catch {
    if (current !== request) return
    stopCamera()
    showStatus('Camera unavailable. Allow camera access on HTTPS or localhost, or choose a sample.')
  }
})
byId('freeze').addEventListener('click', () => {
  frozen = !frozen
  byId('freeze').textContent = frozen ? 'Resume' : 'Freeze'
  if (frozen) cancelAnimationFrame(animation)
  else animation = requestAnimationFrame(liveFrame)
})
window.addEventListener('pagehide', () => {
  request++
  stopCamera()
})
const attract = byId('attract')
const exploreButton = byId('explore')
const explorePanels = ['explore-header', 'explore-controls', 'inspect-hint'].map(byId)

function setExploring(active) {
  exploring = active
  byId('exhibit').dataset.mode = active ? 'explore' : 'kiosk'
  byId('processing-label').hidden = !active
  byId('preview-filter').hidden = active
  attract.hidden = active
  for (const panel of explorePanels) panel.hidden = !active
  for (const canvas of imageCanvases) canvas.tabIndex = active ? 0 : -1
}

function startAttractMode() {
  const returning = exploring
  setExploring(false)
  selectedX = 0.52
  selectedY = 0.14
  showMagnifiers(true)
  if (stream) {
    original = undefined
    beforeContext.clearRect(0, 0, before.width, before.height)
    afterContext.clearRect(0, 0, after.width, after.height)
  }
  stopCamera()

  channelSelects.forEach((select, index) => { select.selectedIndex = index })
  let previewIndex = 0
  selectFilter(filters[previewIndex])
  const sample = sampleButtons[0]
  showImage(sample.dataset.sample, sample.id)
  previewTimer = setInterval(() => {
    previewIndex = (previewIndex + 1) % filters.length
    selectFilter(filters[previewIndex])
  }, previewDelay)

  if (returning) {
    exploreButton.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }
}

function resetIdleTimer() {
  if (!exploring) return
  clearTimeout(idleTimer)
  idleTimer = setTimeout(startAttractMode, idleDelay)
}

exploreButton.addEventListener('click', () => {
  clearInterval(previewTimer)
  setExploring(true)
  showMagnifiers(false)
  selectFilter(filters[0])
  presetButtons[0].focus({ preventScroll: true })
  resetIdleTimer()
})

for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'change']) {
  document.addEventListener(event, resetIdleTimer, { passive: true })
}

window.addEventListener('resize', draw)
startAttractMode()
