
import { createClient } from '@supabase/supabase-js';

// Using provided credentials from project ID lgxzqobcabiatqoklyuc
const supabaseUrl = 'https://lgxzqobcabiatqoklyuc.supabase.co';
const supabaseKey = 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

export const isSupabaseConfigured = 
  supabaseUrl.length > 10 && 
  supabaseKey.length > 10 && 
  !supabaseUrl.includes('placeholder');

if (isSupabaseConfigured) {
  console.info("DATABASE: Supabase Cloud Link Established for Siddhi Kabel.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
