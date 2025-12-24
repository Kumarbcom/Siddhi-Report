
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { CustomerMasterItem } from '../types';

const getUuid = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    if (isSupabaseConfigured) {
      try {
        // Pagination Loop
        let allData: any[] = [];
        let page = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await supabase
            .from('customer_master')
            .select('*')
            .order('created_at', { ascending: false })
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
            customerName: row.customer_name,
            group: row.group_name,
            salesRep: row.sales_rep,
            status: row.status,
            customerGroup: row.customer_group,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          await dbService.putBatch(STORES.CUSTOMERS, synced);
          return synced;
        }
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("Customer Master: Cloud sync unavailable. Falling back to local data.");
        } else {
          console.error("Customer Master: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<CustomerMasterItem>(STORES.CUSTOMERS);
  },

  async createBulk(items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]): Promise<CustomerMasterItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: getUuid(), createdAt: timestamp }));

    if (isSupabaseConfigured) {
      try {
        const rows = newItems.map(i => ({
          id: i.id,
          customer_name: i.customerName,
          group_name: i.group,
          sales_rep: i.salesRep,
          status: i.status,
          customer_group: i.customerGroup,
          created_at: new Date(i.createdAt).toISOString()
        }));
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const { error } = await supabase.from('customer_master').insert(rows.slice(i, i + CHUNK_SIZE));
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        console.error("Customer Master: Sync failed:", e?.message || e);
      }
    }

    await dbService.putBatch(STORES.CUSTOMERS, newItems);
    return newItems;
  },

  async update(item: CustomerMasterItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('customer_master').update({
          customer_name: item.customerName,
          group_name: item.group,
          sales_rep: item.salesRep,
          status: item.status,
          customer_group: item.customerGroup
        }).eq('id', item.id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Customer Master: Cloud update failed:", e?.message || e);
      }
    }
    await dbService.put(STORES.CUSTOMERS, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('customer_master').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Customer Master: Cloud delete failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.delete(STORES.CUSTOMERS, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // Delete all records by using a filter that matches everything
        const { error } = await supabase.from('customer_master').delete().gte('created_at', '1970-01-01');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Customer Master: Cloud clear failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.clear(STORES.CUSTOMERS);
  }
};
