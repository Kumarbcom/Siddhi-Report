
import { supabase } from './supabase';
import { CustomerMasterItem } from '../types';
import { dbService, STORES } from './db';

const BATCH_SIZE = 1000;

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    const allData: CustomerMasterItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        const { data, error } = await supabase
          .from('customer_master')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            customerName: row.customer_name,
            group: row.group_name,
            salesRep: row.sales_rep,
            status: row.status,
            customerGroup: row.customer_group,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          mapped.forEach((item: CustomerMasterItem) => allData.push(item));
          if (data.length < BATCH_SIZE) hasMore = false;
          else page++;
        } else { hasMore = false; }
      }
      await dbService.clearStore(STORES.CUSTOMERS);
      await dbService.putBatch(STORES.CUSTOMERS, allData);
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Customers), using IndexedDB.');
      return await dbService.getAll<CustomerMasterItem>(STORES.CUSTOMERS);
    }
  },

  async createBulk(items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]): Promise<CustomerMasterItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(i => ({
      id: i.id,
      customer_name: i.customerName,
      group_name: i.group,
      sales_rep: i.salesRep,
      status: i.status,
      customer_group: i.customerGroup,
      created_at: new Date(i.createdAt).toISOString()
    }));
    try {
      const chunks = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) chunks.push(rows.slice(i, i + BATCH_SIZE));
      const CONCURRENCY = 5;
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(chunk => supabase.from('customer_master').insert(chunk)));
      }
    } catch (e) { console.warn('Supabase bulk insert failed (Customers), synced locally.'); }
    await dbService.putBatch(STORES.CUSTOMERS, newItems);
    return newItems;
  },

  async update(item: CustomerMasterItem): Promise<void> {
    try {
      await supabase.from('customer_master').update({
        customer_name: item.customerName,
        group_name: item.group,
        sales_rep: item.salesRep,
        status: item.status,
        customer_group: item.customerGroup
      }).eq('id', item.id);
    } catch (e) { console.warn('Supabase update failed (Customers).'); }
    await dbService.putBatch(STORES.CUSTOMERS, [item]);
  },

  async delete(id: string): Promise<void> {
    try {
      await supabase.from('customer_master').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete failed (Customers).'); }
    await dbService.deleteOne(STORES.CUSTOMERS, id);
  },

  async clearAll(): Promise<void> {
    try {
      await supabase.from('customer_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) { console.warn('Supabase clear failed (Customers).'); }
    await dbService.clearStore(STORES.CUSTOMERS);
  }
};
