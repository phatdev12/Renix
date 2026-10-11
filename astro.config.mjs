// @ts-check
import { defineConfig } from 'astro/config';
import pwa from './src/pwa/integration.mjs';

// Fixed port: progress lives in the browser's localStorage, which is tied to the
// origin (http://localhost:4321). A different port would look like an empty profile.
export default defineConfig({
  server: { port: 4321, host: false },
  devToolbar: { enabled: false },
  integrations: [pwa()],
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    server: { strictPort: true },
    preview: { strictPort: true },
    build: { chunkSizeWarningLimit: 1200 },
  },
});
