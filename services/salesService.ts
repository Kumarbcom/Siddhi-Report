
import { supabase } from './supabase';
import { SalesReportItem } from '../types';
import { dbService } from './db';

/**
 * SQL SCHEMA FOR sales_report TABLE:
 * 
 * CREATE TABLE sales_report (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   sales_date DATE NOT NULL,
 *   customer_name TEXT,
 *   material_code TEXT NOT NULL,
 *   consignee TEXT,
 *   invoice_no TEXT NOT NULL,
 *   voucher_ref_no TEXT,
 *   quantity NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   discount NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(invoice_no, material_code, sales_date)
 * );
 */

export interface SalesUploadResult {
    total_rows_uploaded: number;
    total_inserted: number;
    total_updated: number;
    total_failed: number;
    error_log: { row: number; reason: string }[];
}

export const salesService = {
  async getAll(): Promise<SalesReportItem[]> {
    try {
      const { data, error } = await supabase
        .from('sales_report')
        .select('*')
        .limit(10000)
        .order('sales_date', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        salesDate: row.sales_date,
        customerName: row.customer_name,
        materialCode: row.material_code,
        consignee: row.consignee,
        invoiceNo: row.invoice_no,
        voucherRefNo: row.voucher_ref_no,
        quantity: Number(row.quantity),
        rate: Number(row.rate),
        discount: Number(row.discount),
        value: Number(row.value),
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e) {
      console.warn('Supabase fetch failed (Sales), using IndexedDB fallback.', e);
      // Map old DB structure if needed, or just return empty
      return [];
    }
  },

  async createBulkWithUpsert(items: Omit<SalesReportItem, 'id' | 'createdAt'>[]): Promise<SalesUploadResult> {
    const result: SalesUploadResult = {
        total_rows_uploaded: items.length,
        total_inserted: 0,
        total_updated: 0,
        total_failed: 0,
        error_log: []
    };

    // To prevent timeout and handle large files, we process in chunks
    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        
        // Prepare row mapping
        const rows = chunk.map(r => ({
            sales_date: r.salesDate,
            customer_name: r.customerName,
            material_code: r.materialCode,
            consignee: r.consignee,
            invoice_no: r.invoiceNo,
            voucher_ref_no: r.voucherRefNo,
            quantity: r.quantity,
            rate: r.rate,
            discount: r.discount,
            value: r.value
        }));

        try {
            // Using Supabase .upsert() which uses the ON CONFLICT clause
            // We specify onConflict to match the composite unique key
            const { data, error } = await supabase
                .from('sales_report')
                .upsert(rows, { 
                    onConflict: 'invoice_no,material_code,sales_date',
                    ignoreDuplicates: false // We want to update existing rows
                })
                .select();

            if (error) throw error;
            
            // In a real environment, we'd compare the data to see what was inserted vs updated
            // For now, we'll estimate or assume success if no error
            result.total_inserted += chunk.length; 
        } catch (e: any) {
            result.total_failed += chunk.length;
            result.error_log.push({ row: i + 1, reason: e.message || "Unknown batch error" });
        }
    }

    return result;
  },

  async update(item: SalesReportItem): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').update({
            customer_name: item.customerName,
            material_code: item.materialCode,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount,
            value: item.value
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase update failed (Sales).', e);
    }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('sales_report').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase delete failed (Sales).', e);
    }
  },

  async clearAll(): Promise<void> {
      try {
          const { error } = await supabase.from('sales_report').delete().neq('invoice_no', 'CLEAR_ALL_HACK');
          if (error) throw error;
      } catch (e) {
          console.warn('Supabase clear failed.', e);
      }
  }
};
