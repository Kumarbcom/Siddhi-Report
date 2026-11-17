
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { SalesReportItem } from '../types';

export const normalizeToISODate = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const d = new Date((Math.round(val) - 25568) * 86400 * 1000);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(val).trim();
  if (!s || s === 'null' || s === 'undefined' || s === '-') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
};

const getUuid = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    console.log('📊 SalesService.getAll() called');
    if (isSupabaseConfigured) {
      console.log('☁️ Supabase is configured, fetching from cloud...');
      try {
        const PAGE_SIZE = 1000;
        console.log(`📄 Fetching first page (PAGE_SIZE: ${PAGE_SIZE})...`);

        // Fetch first page. Note: We don't strictly rely on 'count' as it can be blocked by RLS.
        const { data: firstPage, error: firstError } = await supabase
          .from('sales_report')
          .select('*')
          .order('date', { ascending: false })
          .order('voucher_no', { ascending: false })
          .order('id', { ascending: true })
          .range(0, PAGE_SIZE - 1);

        if (firstError) {
          console.error('❌ Error fetching first page:', firstError);
          // If permission denied (RLS), we should know
          if (firstError.code === '42501') {
            console.error('⛔ PERMISSION DENIED: Check Supabase RLS policies for sales_report table.');
            alert("Sync Error: Permission Denied. Please check database access rights.");
          }
          throw new Error(firstError.message);
        }

        const initialData = firstPage || [];
        console.log(`✅ First page fetched. Items: ${initialData.length}`);

        const allData: any[] = [...initialData];

        // If we got a full page, there might be more. Fetch simply by iterating.
        if (initialData.length === PAGE_SIZE) {
          console.log(`📚 Full page detected. Fetching remaining pages...`);
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            console.log(`🔄 Fetching page ${page + 1}...`);
            const { data: nextPage, error: nextError } = await supabase
              .from('sales_report')
              .select('*')
              .order('date', { ascending: false })
              .order('voucher_no', { ascending: false })
              .order('id', { ascending: true })
              .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (nextError) {
              console.error(`❌ Error fetching page ${page + 1}:`, nextError);
              break; // Stop fetching but save what we have
            }

            if (nextPage && nextPage.length > 0) {
              allData.push(...nextPage);
              console.log(`✅ Page ${page + 1} fetched. Items: ${nextPage.length}`);
              page++;
              // If this page is partially full, it's the last one
              if (nextPage.length < PAGE_SIZE) hasMore = false;
            } else {
              hasMore = false;
            }

            // Safety break for extremely large datasets (limit to 100k for now to prevent loops)
            if (page > 100) {
              console.warn("⚠️ Reached 100 pages limit. Stopping fetch.");
              hasMore = false;
            }
          }
        }

        console.log(`✅ All data fetched from cloud. Total items: ${allData.length}`);
        const data = allData;
        const synced: SalesReportItem[] = [];

        if (data && data.length > 0) {
          console.log(`🔄 Transforming and Saving ${data.length} records in chunks...`);

          // PRESERVATION CHECK: Check if local storage has records that are NEWER or MISSING from cloud
          const existingLocal = await dbService.getAll<SalesReportItem>(STORES.SALES);
          let unsyncedLocal: SalesReportItem[] = [];

          if (existingLocal && existingLocal.length > 0) {
            // Find latest date in cloud data
            const latestCloudDate = data.reduce((max: string, r: any) => (r.date && r.date > max ? r.date : max), '');
            
            // Check if local has records strictly newer than cloud's newest date
            if (latestCloudDate) {
              unsyncedLocal = existingLocal.filter(l => l.date && l.date > latestCloudDate);
            }
            // If local count is significantly higher, also preserve records from August 2026 onwards if cloud ends in July
            if (unsyncedLocal.length === 0 && existingLocal.length > data.length) {
              unsyncedLocal = existingLocal.filter(l => l.date && l.date >= '2026-08-01');
            }

            if (unsyncedLocal.length > 0) {
              console.warn(`🛡️ Preserving ${unsyncedLocal.length} local records newer than cloud (latest cloud date: ${latestCloudDate}). They will NOT be wiped!`);
            }
          }

          // Clear local sales store to prevent duplication of cloud records
          await dbService.clear(STORES.SALES);

          // Process in chunks to avoid blocking UI
          const PROCESS_CHUNK_SIZE = 2000;
          for (let i = 0; i < data.length; i += PROCESS_CHUNK_SIZE) {
            const chunk = data.slice(i, i + PROCESS_CHUNK_SIZE).map((row: any) => ({
              id: row.id,
              date: row.date,
              customerName: String(row.customer_name || ''),
              particulars: String(row.particulars || ''),
              consignee: String(row.consignee || ''),
              voucherNo: String(row.voucher_no || ''),
              voucherRefNo: String(row.voucher_ref_no || ''),
              quantity: Number(row.quantity) || 0,
              value: Number(row.value) || 0,
              createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
            }));

            synced.push(...chunk);
            await dbService.putBatch(STORES.SALES, chunk);
            // Yield to main thread
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          // Re-insert preserved unsynced local records so user NEVER loses their locally updated data
          if (unsyncedLocal.length > 0) {
            console.log(`💾 Restoring ${unsyncedLocal.length} preserved local records to IndexedDB...`);
            await dbService.putBatch(STORES.SALES, unsyncedLocal);
            synced.push(...unsyncedLocal);
          }

          console.log(`✅ Sales data saved to IndexedDB successfully. Total active records: ${synced.length}`);
          return synced;
        } else {
          console.warn('⚠️ No data returned from Supabase [Empty Table or RLS Restriction]');
        }
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("⚠️ Sales Report: Cloud sync unavailable (Network). Falling back to local data.");
        } else {
          console.error("❌ Sales Report: Cloud fetch failed:", e?.message || e);
          console.error("Error stack:", e?.stack);
        }
      }
    } else {
      console.log('📴 Supabase not configured, using local data');
    }

    console.log('📂 Fetching from IndexedDB...');
    const localData = await dbService.getAll<SalesReportItem>(STORES.SALES);
    console.log(`📊 Returning ${localData.length} records from IndexedDB`);
    return localData;
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({
      ...i,
      id: getUuid(),
      date: normalizeToISODate(i.date) || i.date,
      quantity: Number(i.quantity) || 0,
      value: Number(i.value) || 0,
      createdAt: timestamp
    }));

    if (isSupabaseConfigured) {
      try {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
          const chunk = newItems.slice(i, i + CHUNK_SIZE).map(r => ({
            id: r.id,
            date: normalizeToISODate(r.date),
            customer_name: r.customerName || '',
            particulars: r.particulars || '',
            consignee: r.consignee || '',
            voucher_no: r.voucherNo || '',
            voucher_ref_no: r.voucherRefNo || '',
            quantity: Number(r.quantity) || 0,
            value: Number(r.value) || 0,
            created_at: new Date(r.createdAt).toISOString()
          }));

          const { error } = await supabase.from('sales_report').insert(chunk);
          if (error) {
            console.error(`❌ Cloud insert failed at chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, error);
            throw new Error(`Cloud upload failed: ${error.message}`);
          }
          console.log(`☁️ Uploaded chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(newItems.length / CHUNK_SIZE)}`);
        }
      } catch (e: any) {
        console.error("Sales Report: Sync to Supabase failed:", e?.message || e);
        // Throw so caller knows cloud upload failed!
        throw e;
      }
    }

    // Save to local DB in chunks too
    const DB_CHUNK_SIZE = 2000;
    for (let i = 0; i < newItems.length; i += DB_CHUNK_SIZE) {
      await dbService.putBatch(STORES.SALES, newItems.slice(i, i + DB_CHUNK_SIZE) as SalesReportItem[]);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return newItems as SalesReportItem[];
  },

  /**
   * Pushes local IndexedDB sales records to Supabase Cloud so other users can see them.
   */
  async syncLocalToCloud(
    onProgress?: (pct: number, msg: string) => void
  ): Promise<{ success: boolean; message: string; count?: number }> {
    if (!isSupabaseConfigured) {
      return { success: false, message: "Supabase cloud link is not configured." };
    }

    try {
      if (onProgress) onProgress(5, "Checking local records...");
      const localData = await dbService.getAll<SalesReportItem>(STORES.SALES);
      if (!localData || localData.length === 0) {
        return { success: false, message: "No local sales records found to sync." };
      }

      if (onProgress) onProgress(10, `Found ${localData.length.toLocaleString('en-IN')} local records. Checking cloud database...`);

      // 1. Get latest date from Supabase
      const { data: latestRows, error: queryErr } = await supabase
        .from('sales_report')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

      if (queryErr) throw new Error(queryErr.message);

      const latestCloudDate = latestRows && latestRows.length > 0 ? latestRows[0].date : null;
      console.log('Latest cloud date:', latestCloudDate);

      // 2. Identify which local records are missing from cloud
      let toUpload: SalesReportItem[] = [];

      if (latestCloudDate) {
        // Records newer than latest cloud date
        toUpload = localData.filter(r => r.date && r.date > latestCloudDate);
      }

      // If no records strictly newer, check if local has more records or check from 2026-08-01
      if (toUpload.length === 0) {
        toUpload = localData.filter(r => r.date && r.date >= '2026-08-01');
      }

      if (toUpload.length === 0) {
        return { success: true, count: 0, message: "All local records appear to be synced with the cloud already!" };
      }

      if (onProgress) onProgress(20, `Identified ${toUpload.length.toLocaleString('en-IN')} unsynced records. Uploading to cloud...`);

      const CHUNK_SIZE = 500;
      let uploadedCount = 0;
      for (let i = 0; i < toUpload.length; i += CHUNK_SIZE) {
        const batch = toUpload.slice(i, i + CHUNK_SIZE).map(r => ({
          id: r.id || getUuid(),
          date: normalizeToISODate(r.date),
          customer_name: String(r.customerName || ''),
          particulars: String(r.particulars || ''),
          consignee: String(r.consignee || ''),
          voucher_no: String(r.voucherNo || ''),
          voucher_ref_no: String(r.voucherRefNo || ''),
          quantity: Number(r.quantity) || 0,
          value: Number(r.value) || 0,
          created_at: new Date(r.createdAt || Date.now()).toISOString()
        }));

        const { error: insertErr } = await supabase.from('sales_report').insert(batch);
        if (insertErr) {
          throw new Error(`Upload failed at chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${insertErr.message}`);
        }

        uploadedCount += batch.length;
        const pct = Math.min(95, 20 + Math.round((uploadedCount / toUpload.length) * 75));
        if (onProgress) onProgress(pct, `Uploaded ${uploadedCount.toLocaleString('en-IN')} / ${toUpload.length.toLocaleString('en-IN')} records...`);
      }

      if (onProgress) onProgress(100, `Successfully synced ${uploadedCount.toLocaleString('en-IN')} records to cloud!`);
      return {
        success: true,
        count: uploadedCount,
        message: `Successfully uploaded ${uploadedCount.toLocaleString('en-IN')} sales records to cloud database! All other users will now see the updated data.`
      };
    } catch (e: any) {
      console.error("Cloud push failed:", e);
      return { success: false, message: e.message || "Failed to push records to cloud." };
    }
  },

  async update(item: SalesReportItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('sales_report').update({
          customer_name: item.customerName,
          particulars: item.particulars,
          quantity: item.quantity,
          value: item.value,
          consignee: item.consignee,
          voucher_no: item.voucherNo,
          voucher_ref_no: item.voucherRefNo,
          date: item.date
        }).eq('id', item.id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Sales Report: Cloud update failed:", e?.message || e);
      }
    }
    await dbService.put(STORES.SALES, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('sales_report').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Sales Report: Cloud delete failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.delete(STORES.SALES, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // More robust delete everything filter using UUID inequality
        const { error } = await supabase
          .from('sales_report')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Sales Report: Cloud clear failed:", e?.message || e);
      }
    }
    await dbService.clear(STORES.SALES);
  }
};
