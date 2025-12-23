
import { createClient } from '@supabase/supabase-js';

// Centralized configuration logic
// Corrected URL: added the missing 'q' in 'iatqoklyuc'
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co';
export const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// A valid Supabase key for this project can be a JWT (starting with 'eyJ') 
// or the newer publishable format (starting with 'sb_publishable') provided by the user.
export const isConfigValid = 
  Boolean(SUPABASE_URL && SUPABASE_KEY) && 
  SUPABASE_URL.startsWith('https://') && 
  SUPABASE_URL.includes('.supabase.co') &&
  (SUPABASE_KEY.startsWith('eyJ') || SUPABASE_KEY.startsWith('sb_publishable'));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
