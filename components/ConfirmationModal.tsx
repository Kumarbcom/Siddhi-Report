
import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDanger = false,
    isLoading = false,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onCancel}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                <div className={`h-2 ${isDanger ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full flex-shrink-0 ${isDanger ? 'bg-rose-50' : 'bg-blue-50'}`}>
                            {isDanger ? (
                                <AlertTriangle className={`w-6 h-6 text-rose-600`} />
                            ) : (
                                <AlertTriangle className={`w-6 h-6 text-blue-600`} />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-gray-900 leading-tight mb-2 uppercase tracking-tight">{title}</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">{message}</p>
                        </div>
                        <button onClick={onCancel} className="text-gray-400 hover:text-gray-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3">
                    <button
                        disabled={isLoading}
                        onClick={onConfirm}
                        className={`inline-flex items-center justify-center px-4 py-2 text-sm font-black rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isDanger
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {confirmLabel}
                    </button>
                    <button
                        disabled={isLoading}
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-black text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-lg transition-all"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
