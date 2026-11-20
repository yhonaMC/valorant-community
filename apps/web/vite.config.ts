import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, /api se reenvía a la API: mismo origen que en Docker (nginx),
// así la cookie de sesión funciona igual en ambos entornos y no hace falta CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
