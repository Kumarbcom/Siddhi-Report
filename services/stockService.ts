
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { ClosingStockItem } from '../types';

const getUuid = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    if (isSupabaseConfigured) {
      try {
        // Pagination Loop
        let allData: any[] = [];
        let page = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await supabase
            .from('closing_stock')
            .select('*')
            .order('description', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw new Error(error.message);

          if (data) {
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            page++;
          } else {
            break;
          }
        }
        const data = allData;
        if (data) {
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
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("Closing Stock: Cloud sync unavailable (Network). Falling back to local data.");
        } else {
          console.error("Closing Stock: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<ClosingStockItem>(STORES.STOCK);
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: getUuid(), createdAt: timestamp }));

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
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const { error } = await supabase.from('closing_stock').insert(rows.slice(i, i + CHUNK_SIZE));
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        console.error("Closing Stock: Sync failed:", e?.message || e);
      }
    }

    await dbService.putBatch(STORES.STOCK, newItems);
    return newItems;
  },

  async update(item: ClosingStockItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('closing_stock').update({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          value: item.value
        }).eq('id', item.id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Closing Stock: Cloud update failed:", e?.message || e);
      }
    }
    await dbService.put(STORES.STOCK, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('closing_stock').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Closing Stock: Cloud delete failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.delete(STORES.STOCK, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // More robust delete everything filter using UUID inequality
        const { error } = await supabase
          .from('closing_stock')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Closing Stock: Cloud clear failed:", e?.message || e);
        // We still continue to clear local database
      }
    }
    await dbService.clear(STORES.STOCK);
  }
};
