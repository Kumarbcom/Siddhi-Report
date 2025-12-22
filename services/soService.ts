
import { supabase, isConfigured } from './supabase';
import { PendingSOItem } from '../types';

const LOCAL_STORAGE_KEY = 'pending_so_db_v1';

export const soService = {
  async getAll(): Promise<PendingSOItem[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('pending_sales_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped = data.map((row: any) => ({
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
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        }
      } catch (e) {
        console.error('SO fetch error:', e);
      }
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  },

  async createBulk(items: Omit<PendingSOItem, 'id' | 'createdAt'>[]): Promise<PendingSOItem[]> {
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

    if (isConfigured) {
      try {
        const { data, error } = await supabase.from('pending_sales_orders').insert(rows).select();
        if (!error && data) {
          const newItems = data.map((row: any) => ({
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
          const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
          return newItems;
        }
      } catch (e) {
        console.error('SO bulk add error:', e);
      }
    }

    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: Date.now() }));
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems as PendingSOItem[];
  },

  async update(item: PendingSOItem): Promise<void> {
    if (isConfigured) {
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
      } catch (e) {
        console.error('SO update error:', e);
      }
    }
    const current: PendingSOItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.map(i => i.id === item.id ? item : i)));
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('pending_sales_orders').delete().eq('id', id);
      } catch (e) {
        console.error('SO delete error:', e);
      }
    }
    const current: PendingSOItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('pending_sales_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('SO clear error:', e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
