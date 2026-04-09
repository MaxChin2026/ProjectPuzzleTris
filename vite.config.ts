import { defineConfig } from 'vite';

export default defineConfig({
  root: './code',
  base: './',
  build: {
    outDir: './dist',
  },
  server: {
    port: 5173,
    open: false,
  },
});
