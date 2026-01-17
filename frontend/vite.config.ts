// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import { componentTagger } from "lovable-tagger";

// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "127.0.0.1",
//     port: 5173,
//     hmr: {
//       overlay: false,
//     },
//     proxy: {
//       '/api': {
//         target: 'http://127.0.0.1:5001',
//         changeOrigin: true,
//         secure: false,
//         ws: false,
//         // no rewrite: keep `/api/...` unchanged
//         configure: (proxy, _options) => {
//           proxy.on('error', (err, _req, _res) => {
//             console.log('[proxy] error', err);
//           });
//           proxy.on('proxyReq', (proxyReq, req, _res) => {
//             console.log('[proxy] =>', req.method, req.url);
//           });
//           proxy.on('proxyRes', (proxyRes, req, _res) => {
//             console.log('[proxy] <=', proxyRes.statusCode, req.url);
//           });
//         },
//       },
//     },
//   },
//   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
//   // Add this section:
//   // server: {
//   //   proxy: {
//   //     '/api': {
//   //       target: 'http://127.0.0.1:5000',
//   //       changeOrigin: true,
//   //       secure: false,
//   //     },
//   //   },
//   // },
// }));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

console.log("!!! VITE IS READING THE FRONTEND CONFIG !!!");

export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname, "./"),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true, // This stops it from jumping to 8081
    hmr: {
      overlay: false,
    },
    proxy: {
      // FLASK CONFIG
      '/api/py': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/py/, ''), // Strips prefix
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[Vite Proxy -> Flask]:', req.method, req.url);
          });
        },
      },
      // EXPRESS CONFIG
      '/api/js': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/js/, ''), // Strips prefix
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[Vite Proxy -> Express]:', req.method, req.url);
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));