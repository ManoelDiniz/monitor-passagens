import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/* Extensão .mts de propósito: o package.json do projeto é CommonJS por causa do
   backend, e sem isso o Vite tenta carregar este arquivo como CJS. */
const aqui = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: aqui,
  plugins: [react(), tailwindcss()],
  build: {
    // Compila direto para a pasta que o Fastify já serve.
    outDir: fileURLToPath(new URL('../public', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Em desenvolvimento o front roda no Vite e a API segue no processo Node.
    proxy: { '/api': 'http://localhost:3777' },
  },
});
