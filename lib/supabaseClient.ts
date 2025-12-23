
import { createClient } from '@supabase/supabase-js';

/**
 * Accessing environment variables. 
 * Note: vite.config.ts will perform string replacement for these at build time.
 */
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co';
export const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// Validation logic for the connection
export const isConfigValid = 
  Boolean(SUPABASE_URL && SUPABASE_KEY) && 
  SUPABASE_URL.startsWith('https://') && 
  SUPABASE_URL.includes('.supabase.co') &&
  (SUPABASE_KEY.startsWith('eyJ') || SUPABASE_KEY.startsWith('sb_publishable'));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
