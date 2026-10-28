import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true, // 0.0.0.0 바인딩
  },
});
