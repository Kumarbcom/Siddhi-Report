import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid TypeScript error regarding cwd
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Maps Vercel/System environment variable API_KEY to process.env.API_KEY in the code
      // Uses empty string fallback to prevent "undefined" stringification issues
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  };
});