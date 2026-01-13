
import React, { useState, useEffect } from 'react';
import { LogIn, Shield, Lock, User as UserIcon, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { authService, User } from '../services/authService';

interface LoginViewProps {
    onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                await authService.initializeUsers();
                const users = await authService.getUsers();
                console.log("Fetched users for login:", users);
                setAvailableUsers(users);
                if (users.length > 0 && !username) {
                    // Pre-select first user or leave as empty for "Select your name"
                }
            } catch (err) {
                console.error("Login init error:", err);
                setError("Failed to load user list");
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const user = await authService.login(username, password);
            if (user) {
                onLogin(user);
            } else {
                setError('Invalid username or password');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 mb-6 group transition-transform hover:scale-105 active:scale-95">
                        <Shield className="w-10 h-10 text-white group-hover:animate-pulse" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Siddhi Kabel</h1>
                    <p className="text-gray-500 font-medium tracking-wide text-sm uppercase">Enterprise Report System</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 p-10 border border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Select User / Name</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <select
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-12 pr-10 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold appearance-none focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                                    required
                                >
                                    <option value="" disabled>Select your name</option>
                                    {availableUsers.map(u => (
                                        <option key={u.id} value={u.username}>{u.username}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                                    <ChevronDown className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold placeholder:text-gray-300 placeholder:font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 bg-red-50 text-red-600 p-4 rounded-2xl animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-bold">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-6 h-6" />
                                    <span className="text-lg">Sign In</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400 text-xs font-medium italic">Hint: Select your name above. Default password is 123456.</p>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 font-bold text-sm">© 2026 Siddhi Kabel Corp. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};
