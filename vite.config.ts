
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Defining individual properties instead of the whole 'process' object 
      // prevents Rollup from failing during variable tracing.
      // Gemini SDK requires process.env.API_KEY specifically.
      // Fix: Added Supabase environment variables to process.env definition.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis'
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-utils': ['xlsx', '@google/genai'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    }
  };
});
