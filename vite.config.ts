
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env variables for client-side usage
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY || '')
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Simplified manual chunks to reduce complex trace requirements
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('lucide')) return 'vendor-ui';
              if (id.includes('xlsx')) return 'vendor-utils';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
