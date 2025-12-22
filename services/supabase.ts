
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// A simple check to see if we have valid-looking credentials
export const isConfigured = 
  supabaseUrl.length > 0 && 
  supabaseKey.length > 0 && 
  !supabaseUrl.includes('placeholder');

if (!isConfigured) {
  console.warn("Supabase is not configured. Running in Local Persistence mode.");
}

// Ensure we don't pass an empty string which causes the "Failed to fetch" error immediately
const validUrl = isConfigured ? supabaseUrl : 'https://unconfigured.supabase.co';
const validKey = isConfigured ? supabaseKey : 'unconfigured';

export const supabase = createClient(validUrl, validKey);
