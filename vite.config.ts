
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Direct string replacements for environment variables
      // This prevents Rollup from trying to trace 'process' as a variable
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co'),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI'),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process': '({ env: {} })', // Best way to shim 'process' for Rollup
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
