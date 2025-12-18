
import { supabase } from './supabase';
import { SalesReportItem } from '../types';
import { dbService, STORES } from './db';

const BATCH_SIZE = 1000;

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    const allData: SalesReportItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      while(hasMore) {
        const { data, error } = await supabase
            .from('sales_report_voucher')
            .select('*')
            .order('report_date', { ascending: false })
            .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
        if (error) throw error;
        if (data && data.length > 0) {
            const mapped = data.map((row: any) => ({
                id: row.id,
                date: row.report_date,
                customerName: row.customer_name,
                particulars: row.particulars,
                consignee: row.consignee,
                voucherNo: row.voucher_no,
                voucherRefNo: row.voucher_ref_no,
                quantity: Number(row.quantity),
                value: Number(row.value),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
            }));
            mapped.forEach((m: SalesReportItem) => allData.push(m));
            if (data.length < BATCH_SIZE) hasMore = false;
            else page++;
        } else { hasMore = false; }
      }
      await dbService.clearStore(STORES.SALES);
      await dbService.putBatch(STORES.SALES, allData);
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Sales), using IndexedDB.');
      return await dbService.getAll<SalesReportItem>(STORES.SALES);
    }
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(r => ({
        id: r.id,
        report_date: r.date,
        customer_name: r.customerName,
        particulars: r.particulars,
        consignee: r.consignee,
        voucher_no: r.voucherNo,
        voucher_ref_no: r.voucherRefNo,
        quantity: r.quantity,
        value: r.value,
        created_at: new Date(r.createdAt).toISOString()
    }));

    try {
        const chunks = [];
        for (let i = 0; i < rows.length; i += BATCH_SIZE) chunks.push(rows.slice(i, i + BATCH_SIZE));
        const CONCURRENCY = 5;
        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            const batch = chunks.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(chunk => supabase.from('sales_report_voucher').insert(chunk)));
        }
    } catch (e) { console.warn('Supabase bulk insert failed (Sales), synced locally.'); }
    await dbService.putBatch(STORES.SALES, newItems);
    return newItems;
  },

  async update(item: SalesReportItem): Promise<void> {
    try {
        await supabase.from('sales_report_voucher').update({
            report_date: item.date,
            customer_name: item.customerName,
            particulars: item.particulars,
            consignee: item.consignee,
            voucher_no: item.voucherNo,
            voucher_ref_no: item.voucherRefNo,
            quantity: item.quantity,
            value: item.value
        }).eq('id', item.id);
    } catch (e) { console.warn('Supabase update failed.'); }
    await dbService.putBatch(STORES.SALES, [item]);
  },

  async delete(id: string): Promise<void> {
    try {
        await supabase.from('sales_report_voucher').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete failed.'); }
    await dbService.deleteOne(STORES.SALES, id);
  },

  async clearAll(): Promise<void> {
      try {
          await supabase.from('sales_report_voucher').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
      } catch (e) { console.warn('Supabase clear failed.'); }
      await dbService.clearStore(STORES.SALES);
  }
};
