
import { supabase } from './supabase';
import { ClosingStockItem } from '../types';

const LOCAL_STORAGE_KEY = 'closing_stock_db_v1';

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    const allData: ClosingStockItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase
            .from('closing_stock')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
            const mapped = data.map((row: any) => ({
                id: row.id,
                description: row.description,
                quantity: Number(row.quantity),
                rate: Number(row.rate),
                value: Number(row.value),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
            }));
            mapped.forEach((item: ClosingStockItem) => allData.push(item));

            if (data.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
      }
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Stock), using local.', e);
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
        
        const CHUNK_SIZE = 1000;
        for(let i=0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('closing_stock').insert(chunk);
            if (error) throw error;
        }
    } catch (e) {
        console.warn('Supabase insert failed (Stock).', e);
        const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    }
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
    } catch (e) { console.warn('Supabase update failed.', e); }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('closing_stock').delete().eq('id', id);
        if (error) throw error;
    } catch (e) { console.warn('Supabase delete failed.', e); }
  },

  async clearAll(): Promise<void> {
    try {
        const { error } = await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase clear failed (Stock).', e);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
