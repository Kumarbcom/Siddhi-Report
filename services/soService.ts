
import { supabase } from './supabase';
import { PendingSOItem } from '../types';

const LOCAL_STORAGE_KEY = 'pending_so_db_v1';

export const soService = {
  async getAll(): Promise<PendingSOItem[]> {
    const allData: PendingSOItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase.from('pending_sales_orders')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
            const mapped = data.map((row: any) => ({
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
                dueDate: row.due_on, // matched to due_on
                overDueDays: Number(row.overdue_days),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
            }));
            mapped.forEach((item: PendingSOItem) => allData.push(item));

            if (data.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
      }
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (SO), using local.', e);
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
  },

  async createBulk(items: Omit<PendingSOItem, 'id' | 'createdAt'>[]): Promise<PendingSOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
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
            due_on: i.dueDate, // matched to due_on
            overdue_days: i.overDueDays,
            created_at: new Date(i.createdAt).toISOString()
        }));
        
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('pending_sales_orders').insert(chunk);
            if (error) throw error;
        }
    } catch (e) {
        console.warn('Supabase insert failed (SO).', e);
        const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    }
    return newItems;
  },

  async update(item: PendingSOItem): Promise<void> {
    try {
        const { error } = await supabase.from('pending_sales_orders').update({
            date: item.date,
            order_no: item.orderNo,
            party_name: item.partyName,
            item_name: item.itemName,
            part_no: item.partNo,
            ordered_qty: item.orderedQty,
            balance_qty: item.balanceQty,
            rate: item.rate,
            value: item.value,
            due_on: item.dueDate // matched to due_on
        }).eq('id', item.id);
        if (error) throw error;
    } catch (e) { console.warn('Supabase update failed.', e); }
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('pending_sales_orders').delete().eq('id', id);
        if (error) throw error;
    } catch (e) { console.warn('Supabase delete failed.', e); }
  },

  async clearAll(): Promise<void> {
    try {
        const { error } = await supabase.from('pending_sales_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase clear failed (SO).', e);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
