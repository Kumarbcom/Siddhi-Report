
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { Material, MaterialFormData } from '../types';

const getUuid = () => {
  // Use native browser crypto for standard UUID generation
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for older environments (v4-like format)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('material_master')
          .select('*')
          .order('material_code', { ascending: true });

        if (error) throw new Error(error.message);

        if (data) {
          const syncedData: Material[] = data.map((row: any) => ({
            id: row.id,
            materialCode: row.material_code || '',
            description: row.description || '',
            partNo: row.part_no || '',
            make: row.make || '',
            materialGroup: row.material_group || '',
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
          }));
          await dbService.putBatch(STORES.MATERIALS, syncedData);
          return syncedData;
        }
      } catch (e: any) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
          console.warn("Material Master: Cloud sync unavailable (Network). Falling back to local data.");
        } else {
          console.error("Material Master: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<Material>(STORES.MATERIALS);
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    const newItems: Material[] = materials
      .filter(m => m.description && m.description.trim() !== '')
      .map(m => ({
        ...m,
        id: getUuid(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));

    if (isSupabaseConfigured && newItems.length > 0) {
      try {
        const rows = newItems.map(m => ({
          id: m.id,
          material_code: m.materialCode,
          description: m.description,
          part_no: m.partNo, 
          make: m.make,
          material_group: m.materialGroup,
          created_at: new Date(m.createdAt).toISOString(),
          updated_at: new Date(m.updatedAt || m.createdAt).toISOString()
        }));

        const CHUNK_SIZE = 100;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const { error } = await supabase
            .from('material_master')
            .insert(rows.slice(i, i + CHUNK_SIZE));
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        console.error("Material Master: Sync to Supabase failed:", e?.message || e);
      }
    }

    await dbService.putBatch(STORES.MATERIALS, newItems);
    return newItems;
  },

  async update(material: Material): Promise<void> {
    const now = Date.now();
    const updatedMaterial = { ...material, updatedAt: now };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('material_master')
          .update({
            material_code: updatedMaterial.materialCode,
            description: updatedMaterial.description,
            part_no: updatedMaterial.partNo,
            make: updatedMaterial.make,
            material_group: updatedMaterial.materialGroup,
            updated_at: new Date(now).toISOString()
          })
          .eq('id', updatedMaterial.id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Material Master: Cloud update failed:", e?.message || e);
      }
    }
    await dbService.put(STORES.MATERIALS, updatedMaterial);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('material_master')
          .delete()
          .eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Material Master: Cloud delete failed:", e?.message || e);
      }
    }
    await dbService.delete(STORES.MATERIALS, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('material_master')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Material Master: Cloud clear failed:", e?.message || e);
      }
    }
    await dbService.clear(STORES.MATERIALS);
  }
};
