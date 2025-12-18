
import { supabase } from './supabase';
import { ClosingStockItem } from '../types';
import { dbService, STORES } from './db';

const BATCH_SIZE = 1000;

export const stockService = {
  async getAll(): Promise<ClosingStockItem[]> {
    const allData: ClosingStockItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        const { data, error } = await supabase
          .from('closing_stock')
          .select('*')
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
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
          if (data.length < BATCH_SIZE) hasMore = false;
          else page++;
        } else { hasMore = false; }
      }
      await dbService.clearStore(STORES.STOCK);
      await dbService.putBatch(STORES.STOCK, allData);
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Stock), using IndexedDB.');
      return await dbService.getAll<ClosingStockItem>(STORES.STOCK);
    }
  },

  async createBulk(items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]): Promise<ClosingStockItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(i => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      value: i.value,
      created_at: new Date(i.createdAt).toISOString()
    }));
    try {
      const chunks = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) chunks.push(rows.slice(i, i + BATCH_SIZE));
      const CONCURRENCY = 5;
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(chunk => supabase.from('closing_stock').insert(chunk)));
      }
    } catch (e) { console.warn('Supabase bulk insert failed (Stock), synced locally.'); }
    await dbService.putBatch(STORES.STOCK, newItems);
    return newItems;
  },

  async update(item: ClosingStockItem): Promise<void> {
    try {
      await supabase.from('closing_stock').update({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        value: item.value
      }).eq('id', item.id);
    } catch (e) { console.warn('Supabase update failed.'); }
    await dbService.putBatch(STORES.STOCK, [item]);
  },

  async delete(id: string): Promise<void> {
    try {
      await supabase.from('closing_stock').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete failed.'); }
    await dbService.deleteOne(STORES.STOCK, id);
  },

  async clearAll(): Promise<void> {
    try {
      await supabase.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) { console.warn('Supabase clear failed.'); }
    await dbService.clearStore(STORES.STOCK);
  }
};
