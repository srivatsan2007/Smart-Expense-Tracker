import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, serve the SPA for the original *.html URLs so links/redirects keep working.
const htmlRoutes = () => ({
  name: 'html-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/^\/[\w-]+\.html$/.test(req.url.split('?')[0])) req.url = '/';
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), htmlRoutes()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
});
