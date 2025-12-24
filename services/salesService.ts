
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
    if (isSupabaseConfigured) {
      try {
        // Supabase default limit is 1000. Increasing this to 50,000 for comprehensive reporting.
        // Pagination Loop
        let allData: any[] = [];
        let page = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await supabase
            .from('sales_report')
            .select('*')
            .order('date', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw new Error(error.message);

          if (data) {
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            page++;
          } else {
            break;
          }
        }
        const data = allData;

        if (data) {
          const synced = data.map((row: any) => ({
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

          await dbService.putBatch(STORES.SALES, synced);
          return synced;
        }
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("Sales Report: Cloud sync unavailable (Network). Falling back to local data.");
        } else {
          console.error("Sales Report: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<SalesReportItem>(STORES.SALES);
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: getUuid(), createdAt: timestamp }));

    if (isSupabaseConfigured) {
      try {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
          const chunk = newItems.slice(i, i + CHUNK_SIZE).map(r => {
            console.log('Sending to Supabase - date:', r.date, 'type:', typeof r.date);
            return {
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
            };
          });
          const { error } = await supabase.from('sales_report').insert(chunk);
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        console.error("Sales Report: Sync to Supabase failed:", e?.message || e);
      }
    }

    await dbService.putBatch(STORES.SALES, newItems as SalesReportItem[]);
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
        // Delete all records by using a filter that matches everything
        const { error } = await supabase.from('sales_report').delete().gte('created_at', '1970-01-01');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Sales Report: Cloud clear failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.clear(STORES.SALES);
  }
};
