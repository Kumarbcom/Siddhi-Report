
import { supabase, isConfigured } from './supabase';
import { ClosingStockItem } from '../types';

const LOCAL_STORAGE_KEY = 'closing_stock_db_v1';

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('closing_stock')
          .select('*')
          .order('description', { ascending: true });

        if (!error && data) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            description: row.description,
            quantity: Number(row.quantity) || 0,
            rate: Number(row.rate) || 0,
            value: Number(row.value) || 0,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        }
      } catch (e) {
        console.error('Stock fetch error:', e);
      }
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    const rows = items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      value: i.value
    }));

    if (isConfigured) {
      try {
        const { data, error } = await supabase.from('closing_stock').insert(rows).select();
        if (!error && data) {
          const newItems = data.map((row: any) => ({
            id: row.id,
            description: row.description,
            quantity: Number(row.quantity),
            rate: Number(row.rate),
            value: Number(row.value),
            createdAt: new Date(row.created_at).getTime()
          }));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
          return newItems;
        }
      } catch (e) {
        console.error('Stock bulk add error:', e);
      }
    }

    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: Date.now() }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
    return newItems as ClosingStockItem[];
  },

  async update(item: ClosingStockItem): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('closing_stock').update({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          value: item.value
        }).eq('id', item.id);
      } catch (e) {
        console.error('Stock update error:', e);
      }
    }
    const current: ClosingStockItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.map(i => i.id === item.id ? item : i)));
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('closing_stock').delete().eq('id', id);
      } catch (e) {
        console.error('Stock delete error:', e);
      }
    }
    const current: ClosingStockItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('Stock clear error:', e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
