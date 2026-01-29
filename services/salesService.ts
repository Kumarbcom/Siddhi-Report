
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { SalesReportItem } from '../types';

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

          console.log(`✅ Sales data saved to IndexedDB successfully`);
          console.log(`📊 Returning ${synced.length} sales records`);
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
    const newItems = items.map(i => ({ ...i, id: getUuid(), createdAt: timestamp }));

    if (isSupabaseConfigured) {
      try {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
          const chunk = newItems.slice(i, i + CHUNK_SIZE).map(r => ({
            id: r.id,
            date: r.date,
            customer_name: r.customerName,
            particulars: r.particulars,
            consignee: r.consignee,
            voucher_no: r.voucherNo,
            voucher_ref_no: r.voucherRefNo,
            quantity: r.quantity,
            value: r.value,
            created_at: new Date(r.createdAt).toISOString()
          }));

          const { error } = await supabase.from('sales_report').insert(chunk);
          if (error) throw new Error(error.message);
          console.log(`☁️ Uploaded chunk ${i / CHUNK_SIZE + 1}`);
        }
      } catch (e: any) {
        console.error("Sales Report: Sync to Supabase failed:", e?.message || e);
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
