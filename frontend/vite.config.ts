import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/challans': 'http://127.0.0.1:8000',
      '/vehicles': 'http://127.0.0.1:8000',
      '/violations': 'http://127.0.0.1:8000',
      '/payments': 'http://127.0.0.1:8000',
      '/notifications': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/files': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/officer': {
        target: 'http://127.0.0.1:8000',
        bypass: (req) => {
          if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        bypass: (req) => {
          if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
    },
  },
});
