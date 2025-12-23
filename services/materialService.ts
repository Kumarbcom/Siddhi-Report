
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

        if (error) {
          console.error("Supabase Error fetching materials:", error.message);
          throw error;
        }

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
        console.error("Cloud fetch failed for Materials. Falling back to local cache. Error:", e?.message || e);
      }
    }
    return dbService.getAll<Material>(STORES.MATERIALS);
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    
    // 1. Ensure internal batch consistency (deduplicate by materialCode if present)
    const uniqueIncoming = new Map<string, MaterialFormData>();
    const withoutCode: MaterialFormData[] = [];
    
    materials.forEach(m => {
      const code = (m.materialCode || '').trim().toUpperCase();
      if (code) {
        uniqueIncoming.set(code, m);
      } else {
        withoutCode.push(m);
      }
    });

    const dedupedMaterials = [...Array.from(uniqueIncoming.values()), ...withoutCode];

    const newItems = dedupedMaterials.map(m => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    if (isSupabaseConfigured) {
      try {
        // Prepare rows for Supabase
        const rows = newItems.map(m => ({
          id: m.id,
          material_code: m.materialCode || null, // Ensure empty codes are null for DB constraints if allowed
          description: m.description,
          part_no: m.partNo,
          make: m.make,
          material_group: m.materialGroup,
          created_at: new Date(m.createdAt).toISOString(),
          updated_at: new Date(m.updatedAt || m.createdAt).toISOString()
        }));

        // Upsert to handle potential duplicates on material_code in the cloud
        // We use chunking to prevent large request failures
        const CHUNK_SIZE = 200;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase
            .from('material_master')
            .upsert(chunk, { 
              onConflict: 'material_code',
              ignoreDuplicates: false // We want to update existing records if codes match
            });
          
          if (error) {
            console.error("Supabase Upsert Error Chunk " + i + ":", error.message, error.details, error.hint);
            throw new Error(`Sync Error: ${error.message}`);
          }
        }
      } catch (e: any) {
        // Log detailed error instead of [object Object]
        console.error("Detailed Cloud sync failed for Material import:", e?.message || JSON.stringify(e));
        // We still save locally even if cloud fails
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
