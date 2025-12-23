
import { createClient } from '@supabase/supabase-js';

// Use process.env as defined in vite.config.ts to resolve TypeScript errors with import.meta.env.
// This aligns with how environment variables are handled across the application.
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lgxzqobcabiatqoklyuc.supabase.co';
export const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// A valid Supabase key is either a JWT (starts with eyJ) or a publishable key (starts with sb_publishable)
export const isConfigValid = 
  Boolean(SUPABASE_URL && SUPABASE_KEY) && 
  SUPABASE_URL.startsWith('https://') && 
  SUPABASE_URL.includes('.supabase.co') &&
  (SUPABASE_KEY.startsWith('eyJ') || SUPABASE_KEY.startsWith('sb_publishable'));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
