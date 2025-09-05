// frontend/src/components/Sidebar.jsx
import React from 'react';
import { getFileIcon } from '../utils/fileIcons';

export default function Sidebar({ files = [], activeFile, onFileSelect, onCreateFile, theme = 'dark' }) {
    return (
        <aside
            className={`w-1/6 flex flex-col border-r transition-colors duration-200
                ${theme === 'light'
                ? 'bg-gray-100 border-gray-300'
                : 'bg-slate-800/50 border-slate-700'
            }`}
        >
            <div className="p-3 border-b flex justify-between items-center">
                <h2 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    Arquivos
                </h2>
                <button
                    onClick={onCreateFile}
                    className={`px-2 py-1 text-xs rounded
                        ${theme === 'light'
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-sky-600 hover:bg-sky-700'
                    }`}
                >
                    +
                </button>
            </div>
            <div className="flex-grow p-1 overflow-y-auto">
                {files
                    .filter(file => file?.name)
                    .map(file => (
                        <div
                            key={file.name}
                            onClick={() => onFileSelect(file.name)}
                            className={`flex items-center space-x-2 px-3 py-2 text-sm rounded cursor-pointer
                                ${activeFile === file.name
                                ? (theme === 'light'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-sky-500/30 text-sky-300')
                                : (theme === 'light'
                                    ? 'hover:bg-gray-200'
                                    : 'hover:bg-slate-700/50')
                            }`}
                        >
                            <div className="w-5 h-5">{getFileIcon(file.name)}</div>
                            <span className="truncate">{file.name}</span>
                        </div>
                    ))}
            </div>
        </aside>
    );
}
