
import { createClient } from '@supabase/supabase-js';

// These should be replaced with your actual project URL and Anon Key from Supabase Dashboard
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder-key';

// Create a client with a configuration that avoids throwing errors immediately if URL is invalid
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
