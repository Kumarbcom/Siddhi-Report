
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Use JSON.stringify to ensure values are valid JSON strings for the define plugin.
      // This prevents the "Invalid define value" error during the build process.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co'),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI'),
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Providing a valid JSON object for 'process' to satisfy libraries checking for it.
      // Removed parentheses to ensure strict JSON validity for Vite's define plugin.
      'process': JSON.stringify({ env: {} }),
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
