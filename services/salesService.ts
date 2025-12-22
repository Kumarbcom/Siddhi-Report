
import { supabase } from './supabase';
import { SalesReportItem } from '../types';
import { dbService } from './db';

/**
 * SQL SCHEMA FOR sales_report TABLE:
 * 
 * CREATE TABLE IF NOT EXISTS public.sales_report (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   date DATE NOT NULL,
 *   customer_name TEXT,
 *   particulars TEXT,
 *   consignee TEXT,
 *   voucher_no TEXT,
 *   voucher_ref_no TEXT,
 *   quantity NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Enable public access for demo
 * ALTER TABLE public.sales_report ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public access" ON public.sales_report FOR ALL USING (true) WITH CHECK (true);
 */

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    try {
      const { data, error } = await supabase
        .from('sales_report')
        .select('*')
        .limit(10000)
        .order('date', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
            console.error('DATABASE ERROR: sales_report table is missing in Supabase.');
        }
        throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        customerName: row.customer_name || '',
        particulars: row.particulars || '',
        consignee: row.consignee || '',
        voucherNo: row.voucher_no || '',
        voucherRefNo: row.voucher_ref_no || '',
        quantity: Number(row.quantity) || 0,
        value: Number(row.value) || 0,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e: any) {
      console.warn('Supabase fetch failed (Sales). Using local IndexedDB.', e.message || e);
      return await dbService.getAllSales();
    }
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
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
            if (error) throw error;
        }
    } catch (e: any) {
        console.warn('Supabase insert failed. Saving to local IndexedDB.', e.message || e);
    }

    // Always update local cache to keep UI responsive
    await dbService.addSalesBatch(newItems as SalesReportItem[]);
    return newItems as SalesReportItem[];
  },

  async update(item: SalesReportItem): Promise<void> {
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
        if (error) throw error;
    } catch (e: any) { 
        console.warn('Supabase update failed.', e.message || e);
    }
    await dbService.updateSale(item);
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').delete().eq('id', id);
        if (error) throw error;
    } catch (e: any) { 
        console.warn('Supabase delete failed.', e.message || e);
    }
    await dbService.deleteSale(id);
  },

  async clearAll(): Promise<void> {
      try {
          // Use .neq with a dummy value to delete all rows
          const { error } = await supabase
            .from('sales_report')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (error) throw error;
          console.log('Supabase: Sales report cleared.');
      } catch (e: any) {
          console.error('Supabase clear failed:', e.message || e);
          alert('Could not clear remote database. Clearing local data only.');
      } finally {
          // Crucial: Always clear the local IndexedDB to keep UI in sync
          await dbService.clearAllSales();
      }
  }
};
