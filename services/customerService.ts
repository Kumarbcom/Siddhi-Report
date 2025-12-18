
import { supabase } from './supabase';
import { CustomerMasterItem } from '../types';

const LOCAL_STORAGE_KEY = 'customer_master_db_v1';

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    try {
      const { data, error } = await supabase
        .from('customer_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        customerName: row.customer_name,
        group: row.group_name,
        salesRep: row.sales_rep,
        status: row.status,
        customerGroup: row.customer_group,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e) {
      console.warn('Supabase fetch failed (Customers), using local storage.', e);
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
  },

  async createBulk(items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]): Promise<CustomerMasterItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    
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
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase insert failed (Customers), saving locally.', e);
        const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    }
    return newItems;
  },

  async update(item: CustomerMasterItem): Promise<void> {
    try {
        const { error } = await supabase.from('customer_master').update({
            customer_name: item.customerName,
            group_name: item.group,
            sales_rep: item.salesRep,
            status: item.status,
            customer_group: item.customerGroup
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase update failed (Customers).', e);
    }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('customer_master').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase delete failed (Customers).', e);
    }
  }
};
