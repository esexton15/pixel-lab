export const filters = [
  {
    label: 'Original',
    description: 'Keep the original red, green, and blue values.',
    code: `(r, g, b) => [r, g, b]`,
    apply: (r, g, b) => [r, g, b],
  },
  {
    label: 'Remove red',
    description: 'Set red to zero. Keep green and blue.',
    code: `(r, g, b) => [0, g, b]`,
    apply: (r, g, b) => [0, g, b],
  },
  {
    label: 'Remove blue',
    description: 'Set blue to zero. Keep red and green.',
    code: `(r, g, b) => [r, g, 0]`,
    apply: (r, g, b) => [r, g, 0],
  },
  {
    label: 'Green only',
    description: 'Keep green. Set red and blue to zero.',
    code: `(r, g, b) => [0, g, 0]`,
    apply: (r, g, b) => [0, g, 0],
  },
  {
    label: 'Red only',
    description: 'Keep red. Set green and blue to zero.',
    code: `(r, g, b) => [r, 0, 0]`,
    apply: (r, g, b) => [r, 0, 0],
  },
  {
    label: 'Grayscale',
    description: 'Estimate brightness and use it for all three channels.',
    code: `(r, g, b) => {
  const brightness = 0.21 * r + 0.72 * g + 0.07 * b
  return [brightness, brightness, brightness]
}`,
    apply: (r, g, b) => {
      const brightness = 0.21 * r + 0.72 * g + 0.07 * b
      return [brightness, brightness, brightness]
    },
  },
  {
    label: 'Invert',
    description: 'Subtract each color value from 255.',
    code: `(r, g, b) => [255 - r, 255 - g, 255 - b]`,
    apply: (r, g, b) => [255 - r, 255 - g, 255 - b],
  },
  {
    label: 'Swap',
    description: 'Swap red and blue. Keep green the same.',
    code: `(r, g, b) => [b, g, r]`,
    apply: (r, g, b) => [b, g, r],
  },
  {
    label: 'Blur',
    exploreOnly: true,
    description: 'Average the colors in a 3 × 3 neighborhood.',
    code: `(r, g, b, neighbors) => [
  average(neighbors, 0),
  average(neighbors, 1),
  average(neighbors, 2),
]`,
    apply: (r, g, b, neighbors) => [
      average(neighbors, 0),
      average(neighbors, 1),
      average(neighbors, 2),
    ],
    needsNeighbors: true,
  },
]

export const kioskFilters = filters.filter((filter) => !filter.exploreOnly)

function average(neighbors, channel) {
  return neighbors.reduce((sum, rgb) => sum + rgb[channel], 0) / neighbors.length
}

export function filterImage(input, output, filter, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      const neighbors = filter.needsNeighbors ? nearbyColors(input, x, y, width, height) : undefined
      const [r, g, b] = filter.apply(input[index], input[index + 1], input[index + 2], neighbors)
      output[index] = r
      output[index + 1] = g
      output[index + 2] = b
      output[index + 3] = input[index + 3]
    }
  }
}

function nearbyColors(input, x, y, width, height) {
  const colors = []
  for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
    for (let column = Math.max(0, x - 1); column <= Math.min(width - 1, x + 1); column++) {
      const index = (row * width + column) * 4
      colors.push([input[index], input[index + 1], input[index + 2]])
    }
  }
  return colors
}

export const customChannelRules = [
  { label: 'Input red', code: 'r', apply: (r) => r },
  { label: 'Input green', code: 'g', apply: (r, g) => g },
  { label: 'Input blue', code: 'b', apply: (r, g, b) => b },
  { label: 'Invert red', code: '255 - r', apply: (r) => 255 - r },
  { label: 'Invert green', code: '255 - g', apply: (r, g) => 255 - g },
  { label: 'Invert blue', code: '255 - b', apply: (r, g, b) => 255 - b },
  { label: 'Zero', code: '0', apply: () => 0 },
  { label: 'Full (255)', code: '255', apply: () => 255 },
]
