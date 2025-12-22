
import { supabase, isConfigured } from './supabase';
import { CustomerMasterItem } from '../types';

const LOCAL_STORAGE_KEY = 'customer_master_db_v1';

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('customer_master')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            customerName: row.customer_name,
            group: row.group_name,
            salesRep: row.sales_rep,
            status: row.status,
            customerGroup: row.customer_group,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        }
      } catch (e) {
        console.error('Customer fetch error:', e);
      }
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  },

  async createBulk(items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]): Promise<CustomerMasterItem[]> {
    const rows = items.map(i => ({
      customer_name: i.customerName,
      group_name: i.group,
      sales_rep: i.salesRep,
      status: i.status,
      customer_group: i.customerGroup
    }));

    if (isConfigured) {
      try {
        const { data, error } = await supabase.from('customer_master').insert(rows).select();
        if (!error && data) {
          const newItems = data.map((row: any) => ({
            id: row.id,
            customerName: row.customer_name,
            group: row.group_name,
            salesRep: row.sales_rep,
            status: row.status,
            customerGroup: row.customer_group,
            createdAt: new Date(row.created_at).getTime()
          }));
          const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
          return newItems;
        }
      } catch (e) {
        console.error('Customer bulk add error:', e);
      }
    }

    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: Date.now() }));
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems as CustomerMasterItem[];
  },

  async update(item: CustomerMasterItem): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('customer_master').update({
          customer_name: item.customerName,
          group_name: item.group,
          sales_rep: item.salesRep,
          status: item.status,
          customer_group: item.customerGroup
        }).eq('id', item.id);
      } catch (e) {
        console.error('Customer update error:', e);
      }
    }
    const current: CustomerMasterItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.map(i => i.id === item.id ? item : i)));
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('customer_master').delete().eq('id', id);
      } catch (e) {
        console.error('Customer delete error:', e);
      }
    }
    const current: CustomerMasterItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('customer_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('Customer clear error:', e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
