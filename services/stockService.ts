
import { supabase } from './supabase';
import { ClosingStockItem } from '../types';

/**
 * DATABASE SCHEMA (SQL) - Run this in Supabase SQL Editor:
 * 
 * CREATE TABLE closing_stock (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   description TEXT NOT NULL,
 *   quantity NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- Enable RLS
 * ALTER TABLE closing_stock ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access" ON closing_stock FOR ALL USING (true);
 */

const LOCAL_STORAGE_KEY = 'closing_stock_db_v1';

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    try {
      const { data, error } = await supabase
        .from('closing_stock')
        .select('*')
        .order('description', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        description: row.description,
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        value: Number(row.value) || 0,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e) {
      console.warn('Supabase fetch failed (Stock), using local storage.', e);
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
    try {
        const rows = newItems.map(i => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity,
            rate: i.rate,
            value: i.value,
            created_at: new Date(i.createdAt).toISOString()
        }));
        const { error } = await supabase.from('closing_stock').insert(rows);
        if (error) throw error;
        console.log(`Synced ${rows.length} stock items to Supabase.`);
    } catch (e) {
        console.warn('Supabase insert failed (Stock), saving locally.', e);
    }
    
    // Always update local for offline redundancy
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    
    return newItems;
  },

  async update(item: ClosingStockItem): Promise<void> {
    try {
        const { error } = await supabase.from('closing_stock').update({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            value: item.value
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase update failed.', e); 
    }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('closing_stock').delete().eq('id', id);
        if (error) throw error;
    } catch (e) { 
        console.warn('Supabase delete failed.', e); 
    }
    
    const current: ClosingStockItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    try {
      const { error } = await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (e: any) {
      console.error('Supabase clearAll failed (Stock):', e.message);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
