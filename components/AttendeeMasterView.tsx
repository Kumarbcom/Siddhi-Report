
import React, { useState, useEffect, useRef } from 'react';
import { Attendee } from '../types';
import { attendeeService } from '../services/attendeeService';
import { Plus, Trash2, User, Camera, Save, X, Loader2, Search } from 'lucide-react';

const AttendeeMasterView: React.FC = () => {
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<Omit<Attendee, 'id' | 'createdAt'>>({
        name: '',
        designation: '',
        imageUrl: ''
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadAttendees();
    }, []);

    const loadAttendees = async () => {
        setIsLoading(true);
        const data = await attendeeService.getAll();
        setAttendees(data);
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!formData.name) {
            alert('Name is required');
            return;
        }
        setIsLoading(true);
        try {
            const result = await attendeeService.create(formData);
            if (result) {
                setAttendees(prev => [...prev, result]);
                setFormData({ name: '', designation: '', imageUrl: '' });
                setIsAdding(false);
            }
        } catch (e) {
            alert('Error adding attendee');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this attendee?')) return;
        try {
            await attendeeService.delete(id);
            setAttendees(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            alert('Error deleting attendee');
        }
    };

    const filteredAttendees = attendees.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.designation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-4 max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">Attendee Master</h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Manage Meeting Participants</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all"
                >
                    <Plus className="w-4 h-4" /> Add New Attendee
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search attendees..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {isLoading && !attendees.length ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAttendees.map(attendee => (
                            <div key={attendee.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                                <div className="w-12 h-12 rounded-full bg-violet-100 border-2 border-white overflow-hidden flex items-center justify-center">
                                    {attendee.imageUrl ? (
                                        <img src={attendee.imageUrl} alt={attendee.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-6 h-6 text-violet-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-black text-gray-800">{attendee.name}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{attendee.designation}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(attendee.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isAdding && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 scale-in-center">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-800">Add Attendee</h3>
                            <button onClick={() => setIsAdding(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-center mb-6">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden transition-all group-hover:border-violet-400 group-hover:bg-violet-50">
                                        {formData.imageUrl ? (
                                            <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <Camera className="w-8 h-8 text-gray-400 group-hover:text-violet-500 transition-colors" />
                                                <span className="text-[8px] font-black text-gray-400 uppercase group-hover:text-violet-500">Upload</span>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setFormData({ ...formData, imageUrl: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    {formData.imageUrl && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData({ ...formData, imageUrl: '' });
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Full Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Designation</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                                    value={formData.designation}
                                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-xs font-black text-gray-400 uppercase tracking-wider">Cancel</button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all"
                            >
                                <Save className="w-4 h-4" /> Save Attendee
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendeeMasterView;
