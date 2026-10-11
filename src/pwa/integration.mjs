// Astro integration: after the build, write dist/sw.js from src/pwa/sw.js with the list of files to
// precache (every page, built asset and icon, plus the voice clips) and a version hash of their contents,
// so the service worker only updates when the site actually changed.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('./sw.js', import.meta.url));
// big media is cached on first use instead; the voice clips (~7 MB) are worth having offline right away
const skip = (p) => p === 'sw.js' || (p.startsWith('media/') && !p.startsWith('media/voice/'));

async function walk(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

export default function pwa() {
  return {
    name: 'renix-pwa',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await walk(root)).map((f) => relative(root, f).split(sep).join('/')).filter((p) => !skip(p)).sort();
        const hash = createHash('sha256');
        for (const f of files) hash.update(f).update(await readFile(join(root, f)));
        const urls = files.map((p) => '/' + (p === 'index.html' ? '' : p.endsWith('/index.html') ? p.slice(0, -10) : p));
        const sw = (await readFile(TEMPLATE, 'utf8'))
          .replace("'__VERSION__'", () => JSON.stringify(hash.digest('hex').slice(0, 12)))
          .replace('/*__PRECACHE__*/ []', () => JSON.stringify(urls));
        await writeFile(join(root, 'sw.js'), sw);
        logger.info(`sw.js: ${urls.length} files precached`);
      },
    },
  };
}
