
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { PendingSOItem } from '../types';

const generateSafeId = (): string => {
  if (typeof self !== 'undefined' && self.crypto && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
};

export const soService = {
  async getAll(): Promise<PendingSOItem[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('pending_sales_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const synced = data.map((row: any) => ({
            id: row.id,
            date: row.date,
            orderNo: row.order_no,
            partyName: row.party_name,
            itemName: row.item_name,
            materialCode: row.material_code,
            partNo: row.part_no,
            orderedQty: Number(row.ordered_qty) || 0,
            balanceQty: Number(row.balance_qty) || 0,
            rate: Number(row.rate) || 0,
            discount: Number(row.discount) || 0,
            value: Number(row.value) || 0,
            dueDate: row.due_on,
            overDueDays: Number(row.overdue_days) || 0,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          await dbService.putBatch(STORES.SO, synced);
          return synced;
        }
      } catch (e) {}
    }
    return dbService.getAll<PendingSOItem>(STORES.SO);
  },

  async createBulk(items: Omit<PendingSOItem, 'id' | 'createdAt'>[]): Promise<PendingSOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: generateSafeId(), createdAt: timestamp }));
    
    if (isSupabaseConfigured) {
      try {
        const rows = newItems.map(i => ({
            id: i.id,
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
            overdue_days: i.overDueDays,
            created_at: new Date(i.createdAt).toISOString()
        }));
        await supabase.from('pending_sales_orders').insert(rows);
      } catch (e) {}
    }
    
    await dbService.putBatch(STORES.SO, newItems);
    return newItems;
  },

  async update(item: PendingSOItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pending_sales_orders').update({
            date: item.date,
            order_no: item.orderNo,
            party_name: item.partyName,
            item_name: item.itemName,
            part_no: item.partNo,
            ordered_qty: item.orderedQty,
            balance_qty: item.balanceQty,
            rate: item.rate,
            value: item.value,
            due_on: item.dueDate
        }).eq('id', item.id);
      } catch (e) {}
    }
    await dbService.put(STORES.SO, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pending_sales_orders').delete().eq('id', id);
      } catch (e) {}
    }
    await dbService.delete(STORES.SO, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pending_sales_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {}
    }
    await dbService.clear(STORES.SO);
  }
};
