import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bombcars-client/',
  server: {
    host: true,
    port: 5173,
  },
});
