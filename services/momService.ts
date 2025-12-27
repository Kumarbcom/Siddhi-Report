
import { supabase } from '../lib/supabaseClient';
import { MOM } from '../types';

export const momService = {
    async getAll(): Promise<MOM[]> {
        const { data, error } = await supabase
            .from('moms')
            .select('*')
            .order('meeting_date', { ascending: false });

        if (error) {
            console.error('Error fetching MOMs:', error);
            return [];
        }
        return data || [];
    },

    async getById(id: string): Promise<MOM | null> {
        const { data, error } = await supabase
            .from('moms')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching MOM:', error);
            return null;
        }
        return data;
    },

    async save(mom: Omit<MOM, 'id' | 'createdAt'> & { id?: string }): Promise<MOM | null> {
        const { id, ...rest } = mom;
        if (id) {
            const { data, error } = await supabase
                .from('moms')
                .update(rest)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('moms')
                .insert([rest])
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('moms')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
