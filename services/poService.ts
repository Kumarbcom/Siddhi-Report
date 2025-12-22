
import { supabase, isConfigured } from './supabase';
import { PendingPOItem } from '../types';

export const poService = {
  async getAll(): Promise<PendingPOItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const { data, error } = await supabase.from('pending_purchase_orders').select('*').order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`PO Load Failed: ${error.message}${error.hint ? ' - ' + error.hint : ''}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      date: row.date,
      orderNo: row.order_no,
      partyName: row.party_name,
      itemName: row.item_name,
      materialCode: row.material_code,
      partNo: row.part_no,
      orderedQty: Number(row.ordered_qty),
      balanceQty: Number(row.balance_qty),
      rate: Number(row.rate),
      discount: Number(row.discount),
      value: Number(row.value),
      dueDate: row.due_on,
      overDueDays: Number(row.overdue_days),
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async createBulk(items: Omit<PendingPOItem, 'id' | 'createdAt'>[]): Promise<PendingPOItem[]> {
    if (!isConfigured) throw new Error("Supabase not configured.");
    const rows = items.map(i => ({
      date: i.date,
      order_no: i.orderNo,
      party_name: i.partyName,
      item_name: i.itemName,
      material_code: i.materialCode,
      part_no: i.partNo,
      ordered_qty: i.orderedQty,
      balance_qty: i.balanceQty,
      rate: i.rate,
      discount: i.discount,
      value: i.value,
      due_on: i.dueDate,
      overdue_days: i.overDueDays
    }));
    const { data, error } = await supabase.from('pending_purchase_orders').insert(rows).select();
    if (error) throw new Error(`Insert Failed: ${error.message}`);
    return (data || []).map(row => ({
      id: row.id,
      date: row.date,
      orderNo: row.order_no,
      partyName: row.party_name,
      itemName: row.item_name,
      materialCode: row.material_code,
      partNo: row.part_no,
      orderedQty: Number(row.ordered_qty),
      balanceQty: Number(row.balance_qty),
      rate: Number(row.rate),
      discount: Number(row.discount),
      value: Number(row.value),
      dueDate: row.due_on,
      overDueDays: Number(row.overdue_days),
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async update(item: PendingPOItem): Promise<void> {
    const { error } = await supabase.from('pending_purchase_orders').update({
      date: item.date,
      order_no: item.orderNo,
      party_name: item.partyName,
      item_name: item.itemName,
      balance_qty: item.balanceQty,
      rate: item.rate,
      value: item.value,
      due_on: item.dueDate
    }).eq('id', item.id);
    if (error) throw new Error(`Update Failed: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('pending_purchase_orders').delete().eq('id', id);
    if (error) throw new Error(`Delete Failed: ${error.message}`);
  },

  async clearAll(): Promise<void> {
    const { error } = await supabase.from('pending_purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Clear Failed: ${error.message}`);
  }
};
