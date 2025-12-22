
import { supabase, isConfigured } from './supabase';
import { Material, MaterialFormData } from '../types';

/**
 * Maps Supabase snake_case column names to App camelCase properties
 */
const mapFromDb = (row: any): Material => ({
  id: row.id,
  materialCode: row.material_code || '',
  description: row.description || '',
  partNo: row.part_no || '',
  make: row.make || '',
  materialGroup: row.material_group || '',
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
});

/**
 * Maps App camelCase properties to Supabase snake_case column names
 */
const mapToDb = (data: MaterialFormData | Partial<Material>) => ({
  material_code: (data as any).materialCode,
  description: data.description,
  part_no: (data as any).partNo,
  make: data.make,
  material_group: (data as any).materialGroup
});

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (!isConfigured) throw new Error("Supabase is not configured.");

    const { data, error } = await supabase
      .from('material_master')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Sync Error:', error.message);
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []).map(mapFromDb);
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    if (!isConfigured) throw new Error("Supabase is not configured.");
    
    const dbRows = materials.map(mapToDb);
    const { data, error } = await supabase
      .from('material_master')
      .insert(dbRows)
      .select();

    if (error) throw new Error(`Sync Failed: ${error.message}`);
    return (data || []).map(mapFromDb);
  },

  async update(material: Material): Promise<void> {
    if (!isConfigured) throw new Error("Supabase is not configured.");

    const { error } = await supabase
      .from('material_master')
      .update(mapToDb(material))
      .eq('id', material.id);
    
    if (error) throw new Error(`Update Failed: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    if (!isConfigured) throw new Error("Supabase is not configured.");

    const { error } = await supabase
      .from('material_master')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(`Delete Failed: ${error.message}`);
  },

  async clearAll(): Promise<void> {
    if (!isConfigured) throw new Error("Supabase is not configured.");

    const { error } = await supabase
      .from('material_master')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) throw new Error(`Clear Failed: ${error.message}`);
  }
};
