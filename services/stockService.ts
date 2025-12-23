
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { ClosingStockItem } from '../types';

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('closing_stock')
          .select('*')
          .order('description', { ascending: true });

        if (!error && data) {
          const synced = data.map((row: any) => ({
            id: row.id,
            description: row.description,
            quantity: Number(row.quantity) || 0,
            rate: Number(row.rate) || 0,
            value: Number(row.value) || 0,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          await dbService.putBatch(STORES.STOCK, synced);
          return synced;
        }
      } catch (e) {}
    }
    return dbService.getAll<ClosingStockItem>(STORES.STOCK);
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
    if (isSupabaseConfigured) {
      try {
        const rows = newItems.map(i => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity,
            rate: i.rate,
            value: i.value,
            created_at: new Date(i.createdAt).toISOString()
        }));
        await supabase.from('closing_stock').insert(rows);
      } catch (e) {}
    }
    
    await dbService.putBatch(STORES.STOCK, newItems);
    return newItems;
  },

  async update(item: ClosingStockItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('closing_stock').update({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            value: item.value
        }).eq('id', item.id);
      } catch (e) {}
    }
    await dbService.put(STORES.STOCK, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('closing_stock').delete().eq('id', id);
      } catch (e) {}
    }
    await dbService.delete(STORES.STOCK, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {}
    }
    await dbService.clear(STORES.STOCK);
  }
};
