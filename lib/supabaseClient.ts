
import { createClient } from '@supabase/supabase-js';

// Standard environment variable access via process.env (mapped in vite.config.ts)
// Fix: Switched from import.meta.env to process.env to resolve Property 'env' does not exist on type 'ImportMeta' error.
// URL: lgxzqobcabiatqoklyuc (added missing 'q')
export const SUPABASE_URL = (process.env as any).VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co';
export const SUPABASE_KEY = (process.env as any).VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// A valid Supabase key for this project can be a JWT (starting with 'eyJ') 
// or the newer publishable format (starting with 'sb_publishable') provided by the user.
export const isConfigValid = 
  Boolean(SUPABASE_URL && SUPABASE_KEY) && 
  SUPABASE_URL.startsWith('https://') && 
  SUPABASE_URL.includes('.supabase.co') &&
  (SUPABASE_KEY.startsWith('eyJ') || SUPABASE_KEY.startsWith('sb_publishable'));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
