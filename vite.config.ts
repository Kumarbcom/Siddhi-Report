
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
      // Always obtain the Gemini API key from process.env.API_KEY.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || ''),
      // Define Supabase keys to avoid import.meta.env errors.
      // Updated default URL to https://lgxzqobcabiatqoklyuc.supabase.co
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co'),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI'),
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
