
import { createClient } from '@supabase/supabase-js';

// Prioritize environment variables provided by the build system
// These should be configured in your environment or .env file
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("SUPABASE WARNING: SUPABASE_URL or SUPABASE_KEY is missing. The app will fall back to local storage.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseKey || 'placeholder-key'
);
