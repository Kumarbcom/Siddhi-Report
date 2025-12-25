
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { Material, MaterialFormData } from '../types';

/**
 * Standard RFC 4122 compliant UUID generator.
 * Required for Supabase tables using the UUID primary key type.
 */
const getUuid = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Standard UUID v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (isSupabaseConfigured) {
      try {
        // Explicitly set a high limit to override Supabase's default 1000 records per request limit.
        const PAGE_SIZE = 1000;
        // Initialize with first page and get total count
        const { data: firstPage, error: firstError, count } = await supabase
          .from('material_master')
          .select('*', { count: 'exact' })
          .order('material_code', { ascending: true })
          .range(0, PAGE_SIZE - 1);

        if (firstError) throw new Error(firstError.message);
        const allData: any[] = [...(firstPage || [])];
        const totalItems = count || 0;

        if (totalItems > PAGE_SIZE) {
          const totalPages = Math.ceil(totalItems / PAGE_SIZE);
          const pagePromises = [];

          for (let p = 1; p < totalPages; p++) {
            pagePromises.push(
              supabase
                .from('material_master')
                .select('*')
                .order('material_code', { ascending: true })
                .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
            );
          }

          const results = await Promise.all(pagePromises);
          for (const res of results) {
            if (res.error) throw new Error(res.error.message);
            if (res.data) allData.push(...res.data);
          }
        }
        const data = allData;

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
          console.warn("Material Master: Cloud sync unavailable. Falling back to local data.");
        } else {
          console.error("Material Master: Cloud fetch failed:", e?.message || e);
        }
      }
    }
    return dbService.getAll<Material>(STORES.MATERIALS);
  },

  async create(material: MaterialFormData): Promise<Material> {
    const timestamp = Date.now();
    const newItem: Material = {
      ...material,
      id: getUuid(),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('material_master')
          .insert([{
            id: newItem.id,
            material_code: newItem.materialCode,
            description: newItem.description,
            part_no: newItem.partNo,
            make: newItem.make,
            material_group: newItem.materialGroup,
            created_at: new Date(timestamp).toISOString(),
            updated_at: new Date(timestamp).toISOString()
          }]);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.error("Material Master: Cloud create failed:", e?.message || e);
      }
    }

    await dbService.put(STORES.MATERIALS, newItem);
    return newItem;
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
        throw e;
      }
    }
    await dbService.delete(STORES.MATERIALS, id);
  },

  async clearAll(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // More robust delete everything filter using UUID inequality
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
