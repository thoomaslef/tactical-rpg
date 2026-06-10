import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/tactical-rpg/' : '/',
  server: { port: 5173, open: false },
  build: { target: 'es2020' }
});
