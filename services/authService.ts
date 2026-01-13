
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, STORES } from './db';

export interface User {
    id: string;
    username: string;
    role: 'admin' | 'viewer';
    passwordHash: string;
    lastLogin?: number;
}

const STORAGE_KEY = 'siddhi_auth_user';

export const authService = {
    async initializeUsers() {
        // Initial user list
        const initialUsers = [
            { username: 'Kumar N', role: 'admin' },
            { username: 'Vanditha', role: 'viewer' },
            { username: 'Gurudatta', role: 'viewer' },
            { username: 'Ranajan', role: 'viewer' },
            { username: 'Mohan', role: 'viewer' },
            { username: 'Geetha', role: 'viewer' },
            { username: 'Rachana', role: 'viewer' },
            { username: 'Purushothama', role: 'viewer' },
        ];

        const existingUsers = await this.getUsers();
        if (existingUsers.length === 0) {
            const usersToCreate: User[] = initialUsers.map(u => ({
                id: crypto.randomUUID(),
                username: u.username,
                role: u.role as any,
                passwordHash: '123456', // Storing plain for this simple requirement, should ideally be hashed
                lastLogin: 0
            }));

            if (isSupabaseConfigured) {
                try {
                    await supabase.from('app_users').upsert(usersToCreate.map(u => ({
                        id: u.id,
                        username: u.username,
                        role: u.role,
                        password_hash: u.passwordHash
                    })));
                } catch (e) { console.error("Cloud users init fail", e); }
            }

            for (const u of usersToCreate) {
                await dbService.put(STORES.USERS || 'users', u);
            }
        }
    },

    async getUsers(): Promise<User[]> {
        let users: User[] = [];
        if (isSupabaseConfigured) {
            try {
                const { data } = await supabase.from('app_users').select('*');
                if (data && data.length > 0) {
                    users = data.map((r: any) => ({
                        id: r.id,
                        username: r.username,
                        role: r.role,
                        passwordHash: r.password_hash
                    }));
                }
            } catch (e) {
                console.error("Cloud users fetch fail", e);
            }
        }

        if (users.length === 0) {
            try {
                users = await dbService.getAll<User>(STORES.USERS || 'users');
            } catch (e) {
                console.error("Local users fetch fail", e);
            }
        }

        if (users.length === 0) {
            await this.initializeUsers();
            users = await dbService.getAll<User>(STORES.USERS || 'users');
        }

        return users;
    },

    async login(username: string, password: string): Promise<User | null> {
        const users = await this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === password);
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            return user;
        }
        return null;
    },

    getCurrentUser(): User | null {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    logout() {
        localStorage.removeItem(STORAGE_KEY);
    },

    async changePassword(userId: string, newPass: string): Promise<boolean> {
        const users = await this.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return false;

        user.passwordHash = newPass;

        if (isSupabaseConfigured) {
            try {
                await supabase.from('app_users').update({ password_hash: newPass }).eq('id', userId);
            } catch (e) { console.error("Cloud password update fail", e); }
        }

        await dbService.put(STORES.USERS || 'users', user);

        // Update local session if it's the current user
        const current = this.getCurrentUser();
        if (current && current.id === userId) {
            current.passwordHash = newPass;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }

        return true;
    }
};
