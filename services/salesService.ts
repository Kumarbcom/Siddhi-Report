
import { supabase, isConfigured } from './supabase';
import { SalesReportItem } from '../types';

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('sales_report_voucher')
        .select('*')
        .range(from, from + step - 1)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Sales Load Failed: ${error.message}`);
      
      if (data) {
        allData = [...allData, ...data];
        if (data.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
      from += step;
      if (from > 200000) break;
    }

    return allData.map((row: any) => {
      const displayDate = row.date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '');
      return {
        id: row.id,
        date: displayDate,
        customerName: row.customer_name || '',
        particulars: row.particulars || '',
        consignee: row.consignee || '',
        voucherNo: row.voucher_no || '',
        voucherRefNo: row.voucher_ref_no || '',
        quantity: Number(row.quantity) || 0,
        value: Number(row.value) || 0,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      };
    });
  },

  async createBulk(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesReportItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const CHUNK_SIZE = 500;
    const allInserted: SalesReportItem[] = [];

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE).map(r => ({
            date: r.date,
            customer_name: r.customerName,
            particulars: r.particulars,
            consignee: r.consignee,
            voucher_no: r.voucherNo,
            voucher_ref_no: r.voucherRefNo,
            quantity: r.quantity,
            value: r.value
        }));
        const { data, error } = await supabase.from('sales_report_voucher').insert(chunk).select();
        if (error) throw new Error(`Insert Failed at chunk ${i}: ${error.message}`);
        if (data) {
          allInserted.push(...data.map(row => ({
            id: row.id,
            date: row.date || '',
            customerName: row.customer_name || '',
            particulars: row.particulars || '',
            consignee: row.consignee || '',
            voucherNo: row.voucher_no || '',
            voucherRefNo: row.voucher_ref_no || '',
            quantity: Number(row.quantity) || 0,
            value: Number(row.value) || 0,
            createdAt: new Date(row.created_at).getTime()
          })));
        }
    }
    return allInserted;
  },

  async update(item: SalesReportItem): Promise<void> {
    const { error } = await supabase.from('sales_report_voucher').update({
      customer_name: item.customerName,
      particulars: item.particulars,
      quantity: item.quantity,
      value: item.value,
      consignee: item.consignee,
      voucher_no: item.voucherNo,
      voucher_ref_no: item.voucherRefNo,
      date: item.date
    }).eq('id', item.id);
    if (error) throw new Error(`Update Failed: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('sales_report_voucher').delete().eq('id', id);
    if (error) throw new Error(`Delete Failed: ${error.message}`);
  },

  async clearAll(): Promise<void> {
    const { error } = await supabase.from('sales_report_voucher').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Clear Failed: ${error.message}`);
  }
};
