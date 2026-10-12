import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Listen on the LAN too, so friends on the same network can join the dev server.
    host: true,
    // The game server runs separately on port 3000; forward the WebSocket to it.
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } },
  },
  build: { outDir: 'dist' },
});
