
import { supabase, isConfigValid, SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseClient';

export const isSupabaseConfigured = isConfigValid;

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.info("DATABASE: Supabase Cloud Link verified. Syncing with: " + SUPABASE_URL);
  } else {
    console.info("DATABASE: Local Mode. Supabase configuration missing or using placeholders.");
  }
}

export { supabase };
