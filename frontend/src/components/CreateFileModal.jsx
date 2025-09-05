// frontend/src/components/CreateFileModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { LANGUAGES, getLanguageFromExtension } from '../utils/fileUtils';
import { getIconByExtension } from '../utils/fileIcons';

export default function CreateFileModal({ isOpen, onClose, onCreate, theme = 'dark' }) {
    const inputRef = useRef(null);
    const [fileBaseName, setFileBaseName] = useState('');
    const [selectedExt, setSelectedExt] = useState(LANGUAGES[0]?.ext ?? '.js');

    useEffect(() => {
        if (isOpen) {
            setFileBaseName('');
            setSelectedExt(LANGUAGES[0]?.ext ?? '.js');
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    const handleCreate = () => {
        const base = (fileBaseName || '').trim();
        if (!base) return;
        const fullName = `${base}${selectedExt}`;
        const language = getLanguageFromExtension(fullName);
        onCreate({ name: fullName, language });
        setFileBaseName('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className={`rounded-lg shadow-xl p-6 w-full max-w-lg space-y-4
                ${theme === 'light' ? 'bg-white' : 'bg-slate-800'}
            `}>
                <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    Criar novo arquivo
                </h2>

                <input
                    ref={inputRef}
                    value={fileBaseName}
                    onChange={(e) => setFileBaseName(e.target.value)}
                    type="text"
                    placeholder="Nome do arquivo (sem extensão)"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none
                        ${theme === 'light'
                        ? 'bg-gray-100 border-gray-300 text-gray-900'
                        : 'bg-slate-700 border-slate-600 text-white'
                    }`}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                />

                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.ext}
                            onClick={() => setSelectedExt(lang.ext)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
                                ${selectedExt === lang.ext
                                ? (theme === 'light'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-sky-600 text-white font-semibold')
                                : (theme === 'light'
                                    ? 'bg-gray-100 hover:bg-gray-200'
                                    : 'bg-slate-700 hover:bg-slate-600')
                            }`}
                            type="button"
                        >
                            <span className="w-6 h-6">{getIconByExtension(lang.ext)}</span>
                            <span className="truncate">{lang.name}</span>
                            <span className="ml-auto text-xs opacity-70">{lang.ext}</span>
                        </button>
                    ))}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg
                            ${theme === 'light'
                            ? 'bg-gray-300 hover:bg-gray-400'
                            : 'bg-slate-600 hover:bg-slate-700'
                        }`}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        className={`px-4 py-2 rounded-lg
                            ${theme === 'light'
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-sky-600 hover:bg-sky-700'
                        }`}
                    >
                        Criar
                    </button>
                </div>
            </div>
        </div>
    );
}
