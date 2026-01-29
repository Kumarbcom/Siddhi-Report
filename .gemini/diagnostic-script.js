// Sales Data Sync Diagnostic Script
// Run this in the browser console to diagnose sync issues

console.log('🔍 Starting Sales Data Sync Diagnostic...\n');

// 1. Check Supabase Configuration
console.log('1️⃣ Checking Supabase Configuration:');
try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || supabaseUrl.includes('your-project')) {
        console.error('❌ Supabase URL not configured properly');
    } else {
        console.log(`✅ Supabase URL: ${supabaseUrl}`);
    }

    if (!supabaseKey || supabaseKey.includes('your-anon-key')) {
        console.error('❌ Supabase Key not configured properly');
    } else {
        console.log(`✅ Supabase Key configured (${supabaseKey.substring(0, 20)}...)`);
    }
} catch (e) {
    console.error('❌ Error checking Supabase config:', e);
}

// 2. Check IndexedDB
console.log('\n2️⃣ Checking IndexedDB:');
const dbRequest = indexedDB.open('siddhi_kabel_db');

dbRequest.onsuccess = function (event) {
    const db = event.target.result;
    console.log('✅ IndexedDB opened successfully');

    if (db.objectStoreNames.contains('sales_report')) {
        const transaction = db.transaction(['sales_report'], 'readonly');
        const objectStore = transaction.objectStore('sales_report');
        const countRequest = objectStore.count();

        countRequest.onsuccess = function () {
            console.log(`📊 Sales records in IndexedDB: ${countRequest.result}`);

            if (countRequest.result > 0) {
                // Get a sample record
                const getAllRequest = objectStore.getAll(null, 1);
                getAllRequest.onsuccess = function () {
                    console.log('📄 Sample record:', getAllRequest.result[0]);
                };
            } else {
                console.warn('⚠️ No sales records found in IndexedDB');
            }
        };
    } else {
        console.error('❌ sales_report object store not found');
    }
};

dbRequest.onerror = function () {
    console.error('❌ Failed to open IndexedDB');
};

// 3. Check if Supabase is accessible
console.log('\n3️⃣ Testing Supabase Connection:');
async function testSupabaseConnection() {
    try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sales_report?select=count`, {
            headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            const count = response.headers.get('content-range');
            console.log(`✅ Supabase connection successful`);
            console.log(`📊 Total records in Supabase: ${count}`);
        } else {
            console.error(`❌ Supabase request failed: ${response.status} ${response.statusText}`);
        }
    } catch (e) {
        console.error('❌ Network error connecting to Supabase:', e);
    }
}

testSupabaseConnection();

// 4. Check React State (if available)
console.log('\n4️⃣ Checking React State:');
setTimeout(() => {
    try {
        // Try to access React DevTools
        const reactRoot = document.querySelector('#root');
        if (reactRoot && reactRoot._reactRootContainer) {
            console.log('✅ React app detected');
        } else {
            console.log('ℹ️ React DevTools needed to inspect state');
        }
    } catch (e) {
        console.log('ℹ️ Cannot access React state directly');
    }
}, 1000);

console.log('\n✅ Diagnostic complete. Check the results above.');
console.log('💡 Tip: Look for ❌ errors and ⚠️ warnings to identify issues.');
