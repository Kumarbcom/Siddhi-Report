
import { supabase, isConfigured } from './supabase';
import { SalesReportItem } from '../types';
import { dbService } from './db';

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('sales_report')
          .select('*')
          .limit(10000)
          .order('date', { ascending: false });

        if (!error && data) {
          const mapped = data.map((row: any) => ({
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
          return mapped;
        }
      } catch (e) {
        console.error('Sales fetch network error:', e);
      }
    }
    return await dbService.getAllSales();
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: Date.now() }));
    
    if (isConfigured) {
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
                value: r.value
            }));
            await supabase.from('sales_report').insert(chunk);
        }
      } catch (e) {
        console.error('Sales bulk sync failed:', e);
      }
    }

    await dbService.addSalesBatch(newItems as SalesReportItem[]);
    return newItems as SalesReportItem[];
  },

  async update(item: SalesReportItem): Promise<void> {
    if (isConfigured) {
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
      } catch (e) {
        console.error('Sales update sync failed:', e);
      }
    }
    await dbService.updateSale(item);
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('sales_report').delete().eq('id', id);
      } catch (e) {
        console.error('Sales delete sync failed:', e);
      }
    }
    await dbService.deleteSale(id);
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('sales_report').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('Sales clear sync failed:', e);
      }
    }
    await dbService.clearAllSales();
  }
};
