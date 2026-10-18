import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

const sourceDirectory = decodeURIComponent(
  new URL('./src', import.meta.url).pathname,
).replace(/^\/([A-Z]:)/i, '$1');

export default defineConfig({
  plugins: [devtools(), solidPlugin()],
  resolve: {
    alias: {
      '@': sourceDirectory,
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
