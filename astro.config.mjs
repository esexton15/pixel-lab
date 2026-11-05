import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://esexton15.github.io',
  base: process.env.GITHUB_PAGES === 'true' ? '/pixel-lab' : '/',
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // The exhibit displays the source of each filter function.
    build: { minify: false },
  },
})
