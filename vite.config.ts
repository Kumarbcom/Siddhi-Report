
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Direct string replacements for specific environment variables
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co'),
      'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY || env.VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI'),
      
      // Defining 'process' object helps Rollup trace the variable in dependencies
      'process': JSON.stringify({
        env: {
          API_KEY: env.API_KEY || env.VITE_API_KEY || '',
          SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co',
          SUPABASE_KEY: env.SUPABASE_KEY || env.VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI',
        },
        platform: 'browser',
        browser: true
      }),
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
