
import { supabase, isConfigured } from './supabase';
import { ClosingStockItem } from '../types';

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const { data, error } = await supabase.from('closing_stock').select('*').order('description', { ascending: true });
    
    if (error) {
      throw new Error(`Stock Load Failed: ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      description: row.description,
      quantity: Number(row.quantity),
      rate: Number(row.rate),
      value: Number(row.value),
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const rows = items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      value: i.value
    }));
    const { data, error } = await supabase.from('closing_stock').insert(rows).select();
    if (error) throw new Error(`Insert Failed: ${error.message}`);
    return (data || []).map(row => ({
      id: row.id,
      description: row.description,
      quantity: Number(row.quantity),
      rate: Number(row.rate),
      value: Number(row.value),
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async update(item: ClosingStockItem): Promise<void> {
    const { error } = await supabase.from('closing_stock').update({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      value: item.value
    }).eq('id', item.id);
    if (error) throw new Error(`Update Failed: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('closing_stock').delete().eq('id', id);
    if (error) throw new Error(`Delete Failed: ${error.message}`);
  },

  async clearAll(): Promise<void> {
    const { error } = await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Clear Failed: ${error.message}`);
  }
};
