
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { PendingPOItem } from '../types';

const getUuid = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const poService = {
  async getAll(): Promise<PendingPOItem[]> {
    if (isSupabaseConfigured) {
      try {
        // Pagination Loop
        let allData: any[] = [];
        let page = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await supabase
            .from('pending_purchase_orders')
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
          await dbService.putBatch(STORES.PO, synced);
          return synced;
        }
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("Purchase Orders: Cloud sync unavailable (Network). Falling back to local data.");
        } else {
          console.error("Purchase Orders: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<PendingPOItem>(STORES.PO);
  },

  async createBulk(items: Omit<PendingPOItem, 'id' | 'createdAt'>[]): Promise<PendingPOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: getUuid(), createdAt: timestamp }));

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
          discount: i.discount || 0,
          value: i.value,
          due_on: i.dueDate,
          overdue_days: i.overDueDays || 0,
          created_at: new Date(i.createdAt).toISOString()
        }));

        const CHUNK_SIZE = 200;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const { error } = await supabase.from('pending_purchase_orders').insert(rows.slice(i, i + CHUNK_SIZE));
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        console.error("Purchase Orders: Sync failed:", e?.message || e);
      }
    }

    await dbService.putBatch(STORES.PO, newItems);
    return newItems;
  },

  async update(item: PendingPOItem): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('pending_purchase_orders').update({
          date: item.date,
          order_no: item.orderNo,
          party_name: item.partyName,
          item_name: item.itemName,
          material_code: item.materialCode,
          part_no: item.partNo,
          ordered_qty: item.orderedQty,
          balance_qty: item.balanceQty,
          rate: item.rate,
          discount: item.discount,
          value: item.value,
          due_on: item.dueDate,
          overdue_days: item.overDueDays
        }).eq('id', item.id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Purchase Orders: Cloud update failed:", e?.message || e);
      }
    }
    await dbService.put(STORES.PO, item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('pending_purchase_orders').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Purchase Orders: Cloud delete failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.delete(STORES.PO, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // Delete all records by using a filter that matches everything
        const { error } = await supabase.from('pending_purchase_orders').delete().gte('created_at', '1970-01-01');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Purchase Orders: Cloud clear failed:", e?.message || e);
        throw e;
      }
    }
    await dbService.clear(STORES.PO);
  }
};
