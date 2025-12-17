
import { supabase } from './supabase';
import { SalesReportItem } from '../types';
import { dbService } from './db';

// Sales reports can be huge, so we might still use IndexedDB as a cache or hybrid.
// For now, we prioritize Supabase if connected.

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    const allData: SalesReportItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      const pageSize = 1000; // Chunk size

      while(hasMore) {
        const { data, error } = await supabase
            .from('sales_report')
            .select('*')
            .order('date', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
            const mapped = data.map((row: any) => ({
                id: row.id,
                date: row.date,
                customerName: row.customer_name,
                particulars: row.particulars,
                consignee: row.consignee,
                voucherNo: row.voucher_no,
                voucherRefNo: row.voucher_ref_no,
                quantity: Number(row.quantity),
                value: Number(row.value),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
            }));
            mapped.forEach((item: SalesReportItem) => allData.push(item));

            if (data.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
      }
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Sales), using IndexedDB.', e);
      return await dbService.getAllSales();
    }
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
    // Attempt Supabase
    let sbSuccess = false;
    try {
        // Chunking inserts to avoid payload limits
        const CHUNK_SIZE = 1000;
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
        sbSuccess = true;
    } catch (e) {
        console.warn('Supabase insert failed (Sales), falling back to local DB.', e);
    }

    if (!sbSuccess) {
        await dbService.addSalesBatch(newItems);
    }
    
    return newItems;
  },

  async update(item: SalesReportItem): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').update({
            customer_name: item.customerName,
            particulars: item.particulars,
            quantity: item.quantity,
            value: item.value
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase update failed.', e);
        await dbService.updateSale(item);
    }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').delete().eq('id', id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase delete failed.', e);
        await dbService.deleteSale(id);
    }
  },

  async clearAll(): Promise<void> {
      try {
          // Delete from Supabase
          const { error } = await supabase.from('sales_report').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          if (error) throw error;
      } catch (e) {
          console.warn('Supabase clear failed (Sales).', e);
      }
      // Always clear local DB
      await dbService.clearAllSales();
  }
};
