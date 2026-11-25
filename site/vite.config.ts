import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, /api/lead est servi par la même fonction que sur Vercel.
function devApi(): Plugin {
  return {
    name: 'amane-dev-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''));
      server.middlewares.use('/api/lead', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/lead.js');
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'dev_api', message: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: { assetsInlineLimit: 0, cssMinify: true },
});
