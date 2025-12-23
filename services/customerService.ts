
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { CustomerMasterItem } from '../types';

const getUuid = () => {
  return 'id-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
};

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('customer_master')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
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
          console.warn("Customer Master: Cloud sync unavailable (Network). Falling back to local data.");
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
        const { error } = await supabase.from('customer_master').insert(rows);
        if (error) throw new Error(error.message);
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
      }
    }
    await dbService.delete(STORES.CUSTOMERS, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('customer_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Customer Master: Cloud clear failed:", e?.message || e);
      }
    }
    await dbService.clear(STORES.CUSTOMERS);
  }
};
