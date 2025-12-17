
import { createClient } from '@supabase/supabase-js';

// Configuration from user request
const supabaseUrl = 'https://lgxzqobcabiatqoklyuc.supabase.co';
// WARNING: Using the secret key on the client side is insecure. 
// Ideally, use the ANON PUBLIC KEY (usually starts with 'ey...') for client-side operations.
// We are using the provided 'sb_publishable' key here as requested.
const supabaseKey = 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
