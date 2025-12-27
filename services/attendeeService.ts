
import { supabase, isConfigValid } from '../lib/supabaseClient';
import { dbService, STORES } from './db';
import { Attendee } from '../types';

const getUuid = () => crypto.randomUUID();

export const attendeeService = {
    async getAll(): Promise<Attendee[]> {
        if (isConfigValid) {
            try {
                const { data, error } = await supabase
                    .from('attendees')
                    .select('*')
                    .order('name', { ascending: true });

                if (!error && data) {
                    const synced = data.map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        designation: row.designation,
                        imageUrl: row.image_url,
                        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
                    }));
                    await dbService.putBatch(STORES.ATTENDEES, synced);
                    return synced;
                }
            } catch (e) {
                console.warn("Attendee Sync: Cloud fetch failed, using local.");
            }
        }
        return dbService.getAll<Attendee>(STORES.ATTENDEES);
    },

    async create(item: Omit<Attendee, 'id' | 'createdAt'>): Promise<Attendee | null> {
        const timestamp = Date.now();
        const newItem: Attendee = {
            ...item,
            id: getUuid(),
            createdAt: timestamp
        };

        if (isConfigValid) {
            try {
                const { error } = await supabase
                    .from('attendees')
                    .insert([{
                        id: newItem.id,
                        name: newItem.name,
                        designation: newItem.designation,
                        image_url: newItem.imageUrl,
                        created_at: new Date(timestamp).toISOString()
                    }]);

                if (error) {
                    console.error('Supabase save error:', error.message);
                    // We still save to local if cloud fails
                }
            } catch (e: any) {
                console.error('Attendee cloud save failed:', e.message);
            }
        }

        await dbService.put(STORES.ATTENDEES, newItem);
        return newItem;
    },

    async update(item: Attendee): Promise<void> {
        if (isConfigValid) {
            try {
                const { error } = await supabase
                    .from('attendees')
                    .update({
                        name: item.name,
                        designation: item.designation,
                        image_url: item.imageUrl
                    })
                    .eq('id', item.id);

                if (error) console.error('Supabase update error:', error.message);
            } catch (e: any) {
                console.error('Attendee cloud update failed:', e.message);
            }
        }
        await dbService.put(STORES.ATTENDEES, item);
    },

    async delete(id: string): Promise<void> {
        if (isConfigValid) {
            try {
                const { error } = await supabase
                    .from('attendees')
                    .delete()
                    .eq('id', id);
                if (error) console.error('Supabase delete error:', error.message);
            } catch (e: any) {
                console.error('Attendee cloud delete failed:', e.message);
            }
        }
        await dbService.delete(STORES.ATTENDEES, id);
    }
};
