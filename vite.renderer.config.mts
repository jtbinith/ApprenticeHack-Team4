import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  // Local data (IndexedDB) is tied to the dev server's address, so always use the
  // same port — otherwise a busy port silently switches you to a different database.
  // Run a second copy with CANOPY_DEV_PORT=5180 (and CANOPY_USER_DATA for its own data).
  server: {
    port: Number(process.env.CANOPY_DEV_PORT ?? 5173),
    strictPort: true,
  },
});
