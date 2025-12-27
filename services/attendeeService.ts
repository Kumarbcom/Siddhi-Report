
import { supabase } from '../lib/supabaseClient';
import { Attendee } from '../types';

export const attendeeService = {
    async getAll(): Promise<Attendee[]> {
        const { data, error } = await supabase
            .from('attendees')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching attendees:', error);
            return [];
        }
        return data.map((row: any) => ({
            id: row.id,
            name: row.name,
            designation: row.designation,
            imageUrl: row.image_url,
            createdAt: new Date(row.created_at).getTime()
        }));
    },

    async create(item: Omit<Attendee, 'id' | 'createdAt'>): Promise<Attendee | null> {
        const { data, error } = await supabase
            .from('attendees')
            .insert([{
                name: item.name,
                designation: item.designation,
                image_url: item.imageUrl
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating attendee:', error);
            return null;
        }
        return {
            id: data.id,
            name: data.name,
            designation: data.designation,
            imageUrl: data.image_url,
            createdAt: new Date(data.created_at).getTime()
        };
    },

    async update(item: Attendee): Promise<void> {
        const { error } = await supabase
            .from('attendees')
            .update({
                name: item.name,
                designation: item.designation,
                image_url: item.imageUrl
            })
            .eq('id', item.id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('attendees')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
