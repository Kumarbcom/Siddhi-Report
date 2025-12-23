
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';
import { Material, MaterialFormData } from '../types';

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('material_master')
          .select('*')
          .order('material_code', { ascending: true });

        if (error) throw error;

        if (data) {
          const syncedData = data.map((row: any) => ({
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
        const msg = e?.message || e?.details || "Unknown Cloud Error";
        console.error("Cloud fetch failed for Materials. Using local cache. Error:", msg);
      }
    }
    return dbService.getAll<Material>(STORES.MATERIALS);
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    
    // Clean and prepare local items
    const newItems = materials
      .filter(m => m.description) // Ensure basic validity
      .map(m => ({
        ...m,
        id: crypto.randomUUID(),
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

        // Use same chunked insert pattern as salesService.ts
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase
            .from('material_master')
            .insert(chunk);
          
          if (error) {
            console.error(`Supabase Insert Error [Material Master] Chunk ${i}:`, error.message, error.details);
            throw error;
          }
        }
      } catch (e: any) {
        const errorMsg = e?.message || e?.details || JSON.stringify(e);
        console.error("Sync to Supabase failed for Material Master:", errorMsg);
        // We still save locally to ensure no data loss for the user
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
          
        if (error) throw error;
      } catch (e: any) {
        console.error("Cloud update failed for Material:", e?.message || e);
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
          
        if (error) throw error;
      } catch (e: any) {
        console.error("Cloud delete failed for Material:", e?.message || e);
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
          
        if (error) throw error;
      } catch (e: any) {
        console.error("Cloud clear failed for Materials:", e?.message || e);
      }
    }
    await dbService.clear(STORES.MATERIALS);
  }
};
