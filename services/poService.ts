
import { supabase, isConfigured } from './supabase';
import { PendingPOItem } from '../types';

const LOCAL_STORAGE_KEY = 'pending_po_db_v1';

export const poService = {
  async getAll(): Promise<PendingPOItem[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('pending_purchase_orders')
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
        console.error('PO fetch error:', e);
      }
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  },

  async createBulk(items: Omit<PendingPOItem, 'id' | 'createdAt'>[]): Promise<PendingPOItem[]> {
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
        const { data, error } = await supabase.from('pending_purchase_orders').insert(rows).select();
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
        console.error('PO bulk add error:', e);
      }
    }

    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: Date.now() }));
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems as PendingPOItem[];
  },

  async update(item: PendingPOItem): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('pending_purchase_orders').update({
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
        console.error('PO update error:', e);
      }
    }
    const current: PendingPOItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.map(i => i.id === item.id ? item : i)));
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('pending_purchase_orders').delete().eq('id', id);
      } catch (e) {
        console.error('PO delete error:', e);
      }
    }
    const current: PendingPOItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(i => i.id !== id)));
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('pending_purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('PO clear error:', e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
