import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export default function offline() {
  return {
    name: 'pixel-lab-offline',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(dir)
        const files = (await readdir(output, { recursive: true, withFileTypes: true }))
          .filter((entry) => entry.isFile())
          .map((entry) => relative(output, join(entry.parentPath, entry.name)).split(sep).join('/'))
          .filter((path) => path !== 'sw.js')
          .sort()

        const worker = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8')
        const version = createHash('sha256').update(worker)
        for (const file of files) {
          version.update(file).update(await readFile(join(output, file)))
        }
        await writeFile(join(output, 'sw.js'), [
          `const buildVersion = ${JSON.stringify(version.digest('hex').slice(0, 16))}`,
          `const buildFiles = ${JSON.stringify(files)}`,
          worker,
        ].join('\n'))
      },
    },
  }
}
