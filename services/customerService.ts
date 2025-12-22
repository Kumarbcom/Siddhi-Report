
import { supabase, isConfigured } from './supabase';
import { CustomerMasterItem } from '../types';

export const customerService = {
  async getAll(): Promise<CustomerMasterItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const { data, error } = await supabase.from('customer_master').select('*').order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Customer Load Failed: ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
    }
    
    return (data || []).map(row => ({
      id: row.id,
      customerName: row.customer_name,
      group: row.group_name,
      salesRep: row.sales_rep,
      status: row.status,
      customerGroup: row.customer_group,
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async createBulk(items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]): Promise<CustomerMasterItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const rows = items.map(i => ({
      customer_name: i.customerName,
      group_name: i.group,
      sales_rep: i.salesRep,
      status: i.status,
      customer_group: i.customerGroup
    }));
    const { data, error } = await supabase.from('customer_master').insert(rows).select();
    if (error) throw new Error(`Insert Failed: ${error.message}`);
    return (data || []).map(row => ({
      id: row.id,
      customerName: row.customer_name,
      group: row.group_name,
      salesRep: row.sales_rep,
      status: row.status,
      customerGroup: row.customer_group,
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async update(item: CustomerMasterItem): Promise<void> {
    const { error } = await supabase.from('customer_master').update({
      customer_name: item.customerName,
      group_name: item.group,
      sales_rep: item.salesRep,
      status: item.status,
      customer_group: item.customerGroup
    }).eq('id', item.id);
    if (error) throw new Error(`Update Failed: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('customer_master').delete().eq('id', id);
    if (error) throw new Error(`Delete Failed: ${error.message}`);
  },

  async clearAll(): Promise<void> {
    const { error } = await supabase.from('customer_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Clear Failed: ${error.message}`);
  }
};
