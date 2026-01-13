
import React, { useState, useEffect } from 'react';
import { authService, User } from '../services/authService';
import { Users, Shield, User as UserIcon, Lock, Save, Trash2, X, RefreshCw, Key, ShieldAlert } from 'lucide-react';

const UserManagementView: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        const data = await authService.getUsers();
        setUsers(data);
        setIsLoading(false);
    };

    const handlePasswordChange = async (userId: string) => {
        if (!newPassword) {
            alert('Please enter a new password');
            return;
        }
        setIsLoading(true);
        try {
            await authService.changePassword(userId, newPassword);
            alert('Password updated successfully for user');
            setEditingUser(null);
            setNewPassword('');
            loadUsers();
        } catch (e) {
            alert('Error updating password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'viewer') => {
        // Need to add updateRole to authService
        // For now, let's assume we can update it in the database
        // I will update authService next
    };

    return (
        <div className="flex flex-col h-full gap-4 w-full p-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">System User Management</h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Admin Control Panel</p>
                    </div>
                </div>
                <button
                    onClick={loadUsers}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Refresh List"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Password Hash</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                                            {user.username.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{user.username}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${user.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-[10px] text-gray-400">
                                    {editingUser?.id === user.id ? (
                                        <input
                                            type="text"
                                            className="bg-white border-2 border-indigo-200 rounded-lg px-2 py-1 outline-none text-gray-900 focus:border-indigo-500 w-32"
                                            placeholder="New Password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                        />
                                    ) : (
                                        '••••••••'
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingUser?.id === user.id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePasswordChange(user.id)}
                                                className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm"
                                                title="Save Password"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingUser(null)}
                                                className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                                                title="Cancel"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingUser(user);
                                                setNewPassword('');
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black hover:bg-indigo-100 transition-all ml-auto"
                                        >
                                            <Key className="w-3.5 h-3.5" />
                                            Update Password
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagementView;
