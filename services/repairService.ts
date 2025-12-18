
import { supabase } from './supabase';

export interface RepairSummary {
  table: string;
  updatedCount: number;
  error?: string;
}

export const repairService = {
  /**
   * Helper to add one day to an ISO date string or Date object
   * ensuring we preserve the local "date" meaning.
   */
  addOneDay(dateVal: any): string {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    
    // Add 24 hours
    d.setDate(d.getDate() + 1);
    
    // Return as YYYY-MM-DD to avoid timezone shifts on re-entry 
    // if the column is a DATE type. If it's TIMESTAMPTZ, ISO is better.
    return d.toISOString().split('T')[0];
  },

  async fixSalesReportDates(): Promise<number> {
    const { data, error } = await supabase
      .from('sales_report_voucher')
      .select('id, report_date');

    if (error) throw error;
    if (!data) return 0;

    let updated = 0;
    // Process in chunks to avoid payload limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const updates = chunk.map(row => ({
        id: row.id,
        report_date: this.addOneDay(row.report_date)
      }));

      const { error: updateError } = await supabase
        .from('sales_report_voucher')
        .upsert(updates);
      
      if (updateError) console.error('Error updating sales_report_voucher:', updateError);
      else updated += updates.length;
    }
    return updated;
  },

  async fixPendingSODates(): Promise<number> {
    const { data, error } = await supabase
      .from('pending_sales_orders')
      .select('id, so_date, due_on');

    if (error) throw error;
    if (!data) return 0;

    let updated = 0;
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const updates = chunk.map(row => ({
        id: row.id,
        so_date: this.addOneDay(row.so_date),
        due_on: this.addOneDay(row.due_on)
      }));

      const { error: updateError } = await supabase
        .from('pending_sales_orders')
        .upsert(updates);
      
      if (updateError) console.error('Error updating pending_sales_orders:', updateError);
      else updated += updates.length;
    }
    return updated;
  },

  async fixPendingPODates(): Promise<number> {
    const { data, error } = await supabase
      .from('pending_purchase_orders')
      .select('id, po_date, due_on');

    if (error) throw error;
    if (!data) return 0;

    let updated = 0;
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const updates = chunk.map(row => ({
        id: row.id,
        po_date: this.addOneDay(row.po_date),
        due_on: this.addOneDay(row.due_on)
      }));

      const { error: updateError } = await supabase
        .from('pending_purchase_orders')
        .upsert(updates);
      
      if (updateError) console.error('Error updating pending_purchase_orders:', updateError);
      else updated += updates.length;
    }
    return updated;
  },

  async performSystematicFix(): Promise<RepairSummary[]> {
    const summaries: RepairSummary[] = [];

    try {
      const count1 = await this.fixSalesReportDates();
      summaries.push({ table: 'sales_report_voucher', updatedCount: count1 });
    } catch (e: any) {
      summaries.push({ table: 'sales_report_voucher', updatedCount: 0, error: e.message });
    }

    try {
      const count2 = await this.fixPendingSODates();
      summaries.push({ table: 'pending_sales_orders', updatedCount: count2 });
    } catch (e: any) {
      summaries.push({ table: 'pending_sales_orders', updatedCount: 0, error: e.message });
    }

    try {
      const count3 = await this.fixPendingPODates();
      summaries.push({ table: 'pending_purchase_orders', updatedCount: count3 });
    } catch (e: any) {
      summaries.push({ table: 'pending_purchase_orders', updatedCount: 0, error: e.message });
    }

    return summaries;
  }
};
