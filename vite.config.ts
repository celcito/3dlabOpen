import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/.venv/**',
          '**/venv/**',
          '**/__pycache__/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/tmp/**',
          '**/projects/**',
          '**/.git/**',
          '**/python/venv/**',
        ],
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          rewrite: (path) => {
            // /api/img2-3d/generate          → /generate
            // /api/img2-3d/{id}/sse          → /jobs/{id}/stream
            // /api/img2-3d/{id}/result/{fmt} → /jobs/{id}/file/{fmt}
            // /api/img2-3d/providers         → /providers
            // /api/text-to-3d                → /text-to-3d
            // /api/health                    → /health
            // /api/decimate                  → /decimate
            const resultFile = path.match(/^\/api\/img2-3d\/([^/]+)\/result\/(.+)$/);
            if (resultFile) {
              return `/jobs/${resultFile[1]}/file/${resultFile[2]}`;
            }
            const sse = path.match(/^\/api\/img2-3d\/([^/]+)\/sse$/);
            if (sse) {
              return `/jobs/${sse[1]}/stream`;
            }
            return path
              .replace(/^\/api\/img2-3d/, '')
              .replace(/^\/api/, '');
          },
        },
      },
    },
  };
});
