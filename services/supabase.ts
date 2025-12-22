
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgxzqobcabiatqoklyuc.supabase.co';
const supabaseKey = 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

// Check if credentials are set and valid
export const isConfigured = 
  !!supabaseUrl && 
  !!supabaseKey && 
  supabaseUrl.includes('supabase.co');

if (!isConfigured) {
  console.error("CRITICAL: Supabase credentials are missing or incorrect.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
