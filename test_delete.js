import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lgxzqobcabiatqoklyuc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sVtiXZDvmU1g6O9V0mahDg_bJ0o94iI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  console.log("Fetching first item to delete...");
  const { data, error } = await supabase.from('material_master').select('id').limit(1);
  if (error) {
    console.error("Fetch error:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No items found");
    return;
  }

  const id = data[0].id;
  console.log("Attempting to delete item:", id);
  
  try {
    const { error: delError } = await supabase.from('material_master').delete().eq('id', id);
    if (delError) {
      console.error("Delete error:", delError);
    } else {
      console.log("Successfully deleted item:", id);
    }
  } catch (err) {
    console.error("Exception during delete:", err);
  }
}

test();
