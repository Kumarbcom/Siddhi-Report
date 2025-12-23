
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const PROJECT_URL = 'https://lgxzqobcabiatqoklyuc.supabase.co';
const PROJECT_KEY = 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// Fallback logic to handle cases where process.env might be undefined during SSR or initial load
const supabaseUrl = (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || PROJECT_URL;
const supabaseKey = (typeof process !== 'undefined' && process.env?.SUPABASE_KEY) || PROJECT_KEY;

export const isSupabaseConfigured = 
  Boolean(supabaseUrl && supabaseKey) && 
  !supabaseUrl.includes('placeholder') &&
  supabaseKey.length > 20;

if (isSupabaseConfigured && typeof window !== 'undefined') {
  console.info("DATABASE: Supabase Cloud Link Established for Siddhi Kabel.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
