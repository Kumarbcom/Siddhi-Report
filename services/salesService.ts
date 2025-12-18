
import { supabase } from './supabase';
import { SalesReportItem } from '../types';
import { dbService } from './db';

// Optimize batching for large datasets
const BATCH_SIZE = 1000;

export const salesService = {
  // Fetch all items from Supabase with pagination
  async getAll(): Promise<SalesReportItem[]> {
    const allData: SalesReportItem[] = [];
    try {
      let hasMore = true;
      let page = 0;

      // Check if table exists/connection works
      const check = await supabase.from('sales_report').select('id').limit(1);
      if (check.error) throw check.error;

      while(hasMore) {
        const { data, error } = await supabase
            .from('sales_report')
            .select('*')
            .order('date', { ascending: false })
            .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
        
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
            
            // Push to array in place
            for (let i = 0; i < mapped.length; i++) {
                allData.push(mapped[i]);
            }

            if (data.length < BATCH_SIZE) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
      }
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Sales), falling back to local IndexedDB.', e);
      return await dbService.getAllSales();
    }
  },

  // Create bulk items (Chunked + Parallel for 100k records support)
  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
    const rows = newItems.map(r => ({
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

    let sbSuccess = true;
    try {
        const chunks = [];
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            chunks.push(rows.slice(i, i + BATCH_SIZE));
        }

        // Parallel processing with concurrency limit to speed up upload without overwhelming network
        const CONCURRENCY = 5;
        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            const batch = chunks.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(chunk => 
                supabase.from('sales_report').insert(chunk).then(({ error }) => {
                    if (error) throw error;
                })
            ));
        }
    } catch (e) {
        console.warn('Supabase insert failed (Sales), falling back to local DB.', e);
        sbSuccess = false;
    }

    if (!sbSuccess) {
        await dbService.addSalesBatch(newItems);
    }
    
    return newItems;
  },

  // Update Item
  async update(item: SalesReportItem): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').update({
            date: item.date,
            customer_name: item.customerName,
            particulars: item.particulars,
            consignee: item.consignee,
            voucher_no: item.voucherNo,
            voucher_ref_no: item.voucherRefNo,
            quantity: item.quantity,
            value: item.value
        }).eq('id', item.id);
        
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase update failed, updating local.', e);
        await dbService.updateSale(item);
    }
  },

  // Delete Item
  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').delete().eq('id', id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase delete failed, deleting local.', e);
        await dbService.deleteSale(id);
    }
  },

  // Clear All Items
  async clearAll(): Promise<void> {
      try {
          const { error } = await supabase.from('sales_report').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          if (error) throw error;
      } catch (e) {
          console.warn('Supabase clear failed (Sales).', e);
      }
      await dbService.clearAllSales();
  }
};
