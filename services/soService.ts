
import { supabase } from './supabase';
import { PendingSOItem } from '../types';

/**
 * DATABASE SCHEMA (SQL) - Run this in Supabase SQL Editor:
 * 
 * CREATE TABLE pending_sales_orders (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   date TEXT,
 *   order_no TEXT,
 *   party_name TEXT,
 *   item_name TEXT,
 *   material_code TEXT,
 *   part_no TEXT,
 *   ordered_qty NUMERIC DEFAULT 0,
 *   balance_qty NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   discount NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   due_on TEXT,
 *   overdue_days NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- Enable RLS
 * ALTER TABLE pending_sales_orders ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access" ON pending_sales_orders FOR ALL USING (true);
 */

const LOCAL_STORAGE_KEY = 'pending_so_db_v1';

export const soService = {
  async getAll(): Promise<PendingSOItem[]> {
    try {
      const { data, error } = await supabase
        .from('pending_sales_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        orderNo: row.order_no,
        partyName: row.party_name,
        itemName: row.item_name,
        materialCode: row.material_code,
        partNo: row.part_no,
        orderedQty: Number(row.ordered_qty) || 0,
        balanceQty: Number(row.balance_qty) || 0,
        rate: Number(row.rate) || 0,
        discount: Number(row.discount) || 0,
        value: Number(row.value) || 0,
        dueDate: row.due_on,
        overDueDays: Number(row.overdue_days) || 0,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e) {
      console.warn('Supabase fetch failed (SO), using local storage.', e);
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
  },

  async createBulk(items: Omit<PendingSOItem, 'id' | 'createdAt'>[]): Promise<PendingSOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
    try {
        const rows = newItems.map(i => ({
            id: i.id,
            date: i.date,
            order_no: i.orderNo,
            party_name: i.partyName,
            item_name: i.itemName,
            material_code: i.materialCode,
            part_no: i.partNo,
            ordered_qty: i.orderedQty,
            balance_qty: i.balanceQty,
            rate: i.rate,
            discount: i.discount,
            value: i.value,
            due_on: i.dueDate,
            overdue_days: i.overDueDays,
            created_at: new Date(i.createdAt).toISOString()
        }));
        const { error } = await supabase.from('pending_sales_orders').insert(rows);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase insert failed (SO), saving locally.', e);
    }
    
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems;
  },

  async update(item: PendingSOItem): Promise<void> {
    try {
        const { error } = await supabase.from('pending_sales_orders').update({
            date: item.date,
            order_no: item.orderNo,
            party_name: item.partyName,
            item_name: item.itemName,
            part_no: item.partNo,
            ordered_qty: item.orderedQty,
            balance_qty: item.balanceQty,
            rate: item.rate,
            value: item.value,
            due_on: item.dueDate
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase update failed.', e); 
    }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('pending_sales_orders').delete().eq('id', id);
        if (error) throw error;
        console.log(`Deleted record ${id} from Supabase.`);
    } catch (e) { 
        console.warn('Supabase delete failed.', e); 
    }

    const current: PendingSOItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    try {
      const { error } = await supabase.from('pending_sales_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (e: any) {
      console.error('Supabase clearAll failed (Pending SO):', e.message);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
