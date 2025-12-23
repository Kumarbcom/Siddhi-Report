
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { SalesReportItem } from '../types';

const generateSafeId = (): string => {
  if (typeof self !== 'undefined' && self.crypto && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
};

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('sales_report')
          .select('*')
          .limit(10000)
          .order('date', { ascending: false });

        if (!error && data) {
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
      } catch (e) {}
    }
    return dbService.getAll<SalesReportItem>(STORES.SALES);
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: generateSafeId(), createdAt: timestamp }));
    
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
            await supabase.from('sales_report').insert(chunk);
        }
      } catch (e) {}
    }

    await dbService.putBatch(STORES.SALES, newItems as SalesReportItem[]);
    return newItems as SalesReportItem[];
  },

  async update(item: SalesReportItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('sales_report').update({
            customer_name: item.customerName,
            particulars: item.particulars,
            quantity: item.quantity,
            value: item.value,
            consignee: item.consignee,
            voucher_no: item.voucherNo,
            voucher_ref_no: item.voucherRefNo,
            date: item.date
        }).eq('id', item.id);
      } catch (e) {}
    }
    await dbService.put(STORES.SALES, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('sales_report').delete().eq('id', id);
      } catch (e) {}
    }
    await dbService.delete(STORES.SALES, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('sales_report').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {}
    }
    await dbService.clear(STORES.SALES);
  }
};
