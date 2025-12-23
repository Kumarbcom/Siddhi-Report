
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { Material, MaterialFormData } from '../types';

// Safe ID generation to avoid Rollup trace errors
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
};

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('material_master')
          .select('*')
          .order('material_code', { ascending: true });

        if (error) {
          throw new Error(error.message || 'Supabase fetch error');
        }

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
        const msg = e?.message || (typeof e === 'string' ? e : 'Unknown error');
        console.error("Cloud fetch failed for Materials. Using local cache. Error:", msg);
      }
    }
    return dbService.getAll<Material>(STORES.MATERIALS);
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    
    // Clean and prepare local items
    const newItems: Material[] = materials
      .filter(m => m.description && m.description.trim() !== '')
      .map(m => ({
        ...m,
        id: generateUUID(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));

    if (isSupabaseConfigured && newItems.length > 0) {
      try {
        // Prepare rows for Supabase matching the working pattern of other services
        const rows = newItems.map(m => ({
          id: m.id,
          material_code: (m.materialCode || '').trim() || null,
          description: m.description,
          part_no: m.partNo, 
          make: m.make,
          material_group: m.materialGroup,
          created_at: new Date(m.createdAt).toISOString(),
          updated_at: new Date(m.updatedAt || m.createdAt).toISOString()
        }));

        const CHUNK_SIZE = 200;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase
            .from('material_master')
            .insert(chunk);
          
          if (error) {
            throw new Error(error.message || `Insert error at chunk ${i}`);
          }
        }
      } catch (e: any) {
        const msg = e?.message || (typeof e === 'string' ? e : 'Unknown sync error');
        console.error("Sync to Supabase failed for Material Master:", msg);
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
        const msg = e?.message || 'Update failed';
        console.error("Cloud update failed for Material:", msg);
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
        const msg = e?.message || 'Delete failed';
        console.error("Cloud delete failed for Material:", msg);
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
        const msg = e?.message || 'Clear failed';
        console.error("Cloud clear failed for Materials:", msg);
      }
    }
    await dbService.clear(STORES.MATERIALS);
  }
};
/*
SQL SCHEMA for Supabase:

CREATE TABLE material_master (
  id UUID PRIMARY KEY,
  material_code TEXT UNIQUE,
  description TEXT NOT NULL,
  part_no TEXT,
  make TEXT,
  material_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/
