// frontend/src/components/RecursiveTree.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { IconReveal, IconFolder } from './icons';
import VSCodeContextMenu from './VSCodeContextMenu';
import { getFileIcon } from '../utils/fileIcons';

// Tree node renderer. Expects a TreeNode root with children.
// Props:
// - root: { name, type: 'folder'|'file', content?, children? }
// - selectedPath: string | null
// - onSelectFile(path)
// - onMove(from, toFolder)
// - onCreate({ parentPath, type: 'file'|'folder' }) optional
// - onDelete(path) optional
export default function RecursiveTree({ root, selectedPath, onSelectFile, onMove, onCreate, onDelete, onRename, onDuplicate, onRunFile, onOpenTerminal, onOpenToSide, editingUsers = {} }) {
	const [expanded, setExpanded] = useState(() => new Set(['']));
    const [menu, setMenu] = useState({ open: false, x: 0, y: 0, target: null, isFolder: false });
	const [selection, setSelection] = useState(() => new Set()); // multi-select set of full paths
	const [focused, setFocused] = useState(null);
	const [lastClicked, setLastClicked] = useState(null);
	const [dragOverPath, setDragOverPath] = useState(null);

	// Build a linear list of visible nodes for range selection and keyboard nav
	const visibleNodes = useMemo(() => {
		const list = [];
		const dfs = (node, prefix) => {
			const isFolder = node.type === 'folder';
			const fullPath = [prefix, node.name].filter(Boolean).join('/');
			if (node.name) list.push({ path: fullPath, isFolder });
			if (!isFolder) return;
			const isExpanded = expanded.has(fullPath);
			if (!isExpanded) return;
			const children = Array.isArray(node.children) ? node.children : [];
			for (const c of children) dfs(c, fullPath);
		};
		const rootChildren = Array.isArray(root?.children) ? root.children : [];
		for (const c of rootChildren) dfs(c, '');
		return list;
	}, [root, expanded]);

	// keyboard shortcuts: F2 rename, Del delete (operate on focused/selected)
	React.useEffect(() => {
		const onKey = (e) => {
			if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
			if (menu.open) return; // avoid conflicting while menu open
			if (e.key === 'F2') {
				e.preventDefault();
				const target = selection.size ? Array.from(selection).slice(-1)[0] : selectedPath;
				if (target) onRename?.(target);
			} else if (e.key === 'Delete') {
				e.preventDefault();
				const targets = selection.size ? Array.from(selection) : (selectedPath ? [selectedPath] : []);
				if (targets.length) {
					if (targets.length === 1) onDelete?.(targets[0]);
					else targets.forEach(p => onDelete?.(p));
				}
			} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (!visibleNodes.length) return;
				const current = focused || (selection.size ? Array.from(selection).slice(-1)[0] : visibleNodes[0].path);
				const idx = Math.max(0, visibleNodes.findIndex(n => n.path === current));
				const nextIdx = e.key === 'ArrowDown' ? Math.min(visibleNodes.length - 1, idx + 1) : Math.max(0, idx - 1);
				const next = visibleNodes[nextIdx]?.path;
				if (!next) return;
				setFocused(next);
				if (e.shiftKey) {
					const anchor = lastClicked || current;
					const i1 = Math.max(0, visibleNodes.findIndex(n => n.path === anchor));
					const i2 = Math.max(0, nextIdx);
					const [start, end] = i1 <= i2 ? [i1, i2] : [i2, i1];
					const range = new Set(visibleNodes.slice(start, end + 1).map(n => n.path));
					setSelection(range);
				} else {
					setSelection(new Set([next]));
					setLastClicked(next);
				}
			} else if (e.key === 'Enter' || e.key === ' ') {
				// toggle folder expand/collapse or select file
				const target = focused;
				if (!target) return;
				const node = visibleNodes.find(n => n.path === target);
				if (!node) return;
				if (node.isFolder) {
					setExpanded(prev => { const n = new Set(prev); n.has(target) ? n.delete(target) : n.add(target); return n; });
				} else {
					onSelectFile?.(target);
				}
			} else if ((e.key === 'a' || e.key === 'A') && !e.shiftKey) {
				// New file in focused folder
				const target = focused || (selection.size ? Array.from(selection).slice(-1)[0] : null);
				const node = target ? visibleNodes.find(n => n.path === target) : null;
				const folderPath = node?.isFolder ? target : target?.split('/').slice(0,-1).join('/') || '';
				onCreate?.({ parentPath: folderPath, type: 'file' });
			} else if ((e.key === 'A' && e.shiftKey) || (e.key === 'a' && e.shiftKey)) {
				// New folder
				const target = focused || (selection.size ? Array.from(selection).slice(-1)[0] : null);
				const node = target ? visibleNodes.find(n => n.path === target) : null;
				const folderPath = node?.isFolder ? target : target?.split('/').slice(0,-1).join('/') || '';
				onCreate?.({ parentPath: folderPath, type: 'folder' });
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [menu.open, selection, selectedPath, onRename, onDelete, onSelectFile, onCreate, visibleNodes, focused]);

	const handleDragStart = (e, path) => {
		e.stopPropagation();
		e.dataTransfer.setData('text/plain', path);
		e.dataTransfer.effectAllowed = 'move';
	};

	const handleDragOver = (e, path, isFolder) => {
		if (!isFolder) return;
		e.preventDefault();
		e.stopPropagation();
		if (dragOverPath !== path) {
			setDragOverPath(path);
		}
	};

	const handleDragLeave = (e, path) => {
		e.preventDefault();
		e.stopPropagation();
		if (dragOverPath === path) {
			setDragOverPath(null);
		}
	};

	const handleDrop = (e, targetPath, isFolder) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverPath(null);
		const fromPath = e.dataTransfer.getData('text/plain');
		if (fromPath && fromPath !== targetPath) {
			// Evitar mover uma pasta para dentro de si mesma ou de suas subpastas
			if (isFolder && !targetPath.startsWith(fromPath + '/')) {
				onMove?.(fromPath, targetPath);
			}
		}
	};

	const handleContextMenu = (e, node, path) => {
		e.preventDefault();
		e.stopPropagation();
		setMenu({
			open: true,
			x: e.clientX,
			y: e.clientY,
			target: path,
			isFolder: node.type === 'folder'
		});
	};

	const isRunnableFile = (path) => {
		if (!path) return false;
		const ext = path.split('.').pop().toLowerCase();
		return ['js', 'py', 'java', 'c', 'cpp', 'cc', 'rb', 'go', 'rs', 'sh', 'ts'].includes(ext);
	};

	const toggle = useCallback((path) => {
		setExpanded(prev => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path); else next.add(path);
			return next;
		});
	}, []);

	const buildPath = (prefix, name, isFolder) => {
		const clean = [prefix, name].filter(Boolean).join('/');
		return isFolder ? clean : clean; // same, we don't add trailing slash for files
	};

	const renderNode = (node, prefix) => {
		const isFolder = node.type === 'folder';
		const fullPath = buildPath(prefix, node.name, isFolder);
		const isExpanded = expanded.has(fullPath);
		const isSelected = selection.has(fullPath) || selectedPath === fullPath;
		const isFocused = focused === fullPath;

		return (
			<div key={fullPath}>
				<div
					data-path={fullPath} // for findNodeElement
					draggable={true}
					onDragStart={(e) => handleDragStart(e, fullPath)}
					onDragOver={(e) => handleDragOver(e, fullPath, isFolder)}
					onDragLeave={(e) => handleDragLeave(e, fullPath)}
					onDrop={(e) => handleDrop(e, fullPath, isFolder)}
					className={`flex items-center space-x-1 cursor-pointer select-none rounded ml-1 pr-2 py-[2px] 
						${isSelected ? 'bg-[var(--selection-color)]' : 'hover:bg-[var(--hover-color)]'} 
						${isFocused ? 'ring-1 ring-[var(--primary-color)]' : ''}
						${dragOverPath === fullPath ? 'bg-[var(--selection-color)] ring-2 ring-dashed ring-[var(--primary-color)]' : ''}`}
					style={{ paddingLeft: `${prefix ? prefix.split('/').length * 12 : 4}px` }}
					onClick={(e) => {
						if (isFolder) {
							toggle(fullPath);
						} else {
							onSelectFile && onSelectFile(fullPath);
							setSelection(new Set([fullPath]));
						}
						setFocused(fullPath);
						setLastClicked(fullPath);
					}}
					onContextMenu={(e) => handleContextMenu(e, node, fullPath)}
				>
					<span className={`w-4 h-4 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ opacity: isFolder ? 1 : 0 }}>
						<IconReveal className="w-3 h-3" />
					</span>
					<span className="w-4 h-4 flex-shrink-0 flex items-center justify-center mr-1">
                                                {isFolder ? (isExpanded ? <IconFolder className="w-4 h-4" /> : <IconFolder className="w-4 h-4" />) : getFileIcon(node.name, {size: 16})}
                                        </span>
                                        <span className="truncate flex-grow text-sm">{node.name}</span>
					{/* Editing indicators — colored dots for participants editing this file */}
					{!isFolder && editingUsers[fullPath] && editingUsers[fullPath].length > 0 && (
						<span className="flex items-center gap-0.5 ml-auto flex-shrink-0 pl-1">
							{editingUsers[fullPath].slice(0, 3).map((user, i) => (
								<span
									key={user.userId || i}
									title={`${user.username} está editando`}
									className="editing-user-dot"
									style={{
										width: 7,
										height: 7,
										borderRadius: '50%',
										backgroundColor: user.color,
										flexShrink: 0,
										display: 'inline-block',
										boxShadow: `0 0 4px ${user.color}60`,
										animation: 'pulse-dot 2s ease-in-out infinite',
									}}
								/>
							))}
							{editingUsers[fullPath].length > 3 && (
								<span className="text-[9px] opacity-60" style={{ color: 'var(--text-muted-color)' }}
									title={editingUsers[fullPath].map(u => u.username).join(', ')}
								>+{editingUsers[fullPath].length - 3}</span>
							)}
						</span>
					)}
                                </div>
				{isFolder && isExpanded && node.children && (
					<div>
						{Array.isArray(node.children) ? node.children.map((c) => renderNode(c, fullPath)) : null}
					</div>
				)}
			</div>
		);
	};

	const rootChildren = useMemo(() => Array.isArray(root?.children) ? root.children : [], [root]);
	return (
		<div 
			className="text-[var(--text-color)] min-h-full w-full"
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				e.preventDefault();
				const fromPath = e.dataTransfer.getData('text/plain');
				if (fromPath) {
					const parts = fromPath.split('/');
					// Se o nó já não estiver na raiz, move para a raiz ("")
					if (parts.length > 1) {
						onMove?.(fromPath, "");
					}
				}
			}}
		>
			{rootChildren.map((c) => renderNode(c, ''))}
			<VSCodeContextMenu
				x={menu.x}
				y={menu.y}
				open={menu.open}
				items={(() => {
					if (!menu.target) return [];
					const selectedCount = selection.size || 0;
					const common = [
						{ type: 'item', label: selectedCount > 1 ? `Renomear (último selecionado)` : 'Renomear', shortcut: 'F2', icon: <span className="codicon codicon-edit" />, onClick: () => onRename?.(menu.target) },
						{ type: 'item', label: selectedCount > 1 ? `Excluir (${selectedCount})` : 'Excluir', shortcut: 'Del', danger: true, icon: <span className="codicon codicon-trash" />, onClick: () => {
							if (selection.size > 1) Array.from(selection).forEach(p => onDelete?.(p)); else onDelete?.(menu.target);
						}},
						{ type: 'separator' },
						{ type: 'item', label: 'Duplicar', icon: <span className="codicon codicon-copy" />, onClick: async () => {
							const path = menu.target;
							// Let the backend handle the naming to avoid conflicts and ensure consistency
							onDuplicate?.(path);
						} },
						{ type: 'item', label: 'Copiar Caminho Absoluto', icon: <span className="codicon codicon-clippy" />, onClick: async () => { try { await navigator.clipboard.writeText(menu.target); } catch(_){} } },
						{ type: 'item', label: 'Copiar Caminho Relativo', icon: <span className="codicon codicon-clippy" />, onClick: async () => { try { const parts = menu.target.split('/'); await navigator.clipboard.writeText(parts[parts.length-1] || menu.target); } catch(_){} } },
						{ type: 'item', label: 'Revelar no Explorer', icon: <span className="codicon codicon-go-to-file" />, onClick: () => {
							// Expand ancestors to reveal
							const parts = menu.target.split('/');
							let acc = '';
							setExpanded(prev => { const n = new Set(prev); for (let i=0;i<parts.length-1;i++){ acc = acc ? `${acc}/${parts[i]}` : parts[i]; n.add(acc);} return n; });
							setFocused(menu.target);
							// Scroll into view next tick
							setTimeout(() => { try { document.querySelector(`[data-path="${CSS.escape(menu.target)}"]`)?.scrollIntoView({ block: 'nearest' }); } catch(_){} }, 0);
						} },
					];

					const terminalAction = {
						type: 'item',
						label: 'Abrir no Terminal Integrado',
						icon: <span className="codicon codicon-terminal" />,
						onClick: () => {
							const dir = menu.isFolder ? menu.target : menu.target.split('/').slice(0, -1).join('/');
							onOpenTerminal?.(dir);
						}
					};

					if (menu.isFolder) {
						return [
							{ type: 'item', label: 'Novo Arquivo', shortcut: 'A', icon: <span className="codicon codicon-new-file" />, onClick: () => onCreate?.({ parentPath: menu.target, type: 'file' }) },
							{ type: 'item', label: 'Nova Pasta', shortcut: 'Shift+A', icon: <span className="codicon codicon-new-folder" />, onClick: () => onCreate?.({ parentPath: menu.target, type: 'folder' }) },
							{ type: 'separator' },
							terminalAction,
							{ type: 'separator' },
							...common,
						];
					}

					return [
						{ type: 'item', label: 'Abrir ao Lado', shortcut: 'Ctrl+Enter', icon: <span className="codicon codicon-split-horizontal" />, onClick: () => { onOpenToSide?.(menu.target); } },
						{ 
							type: 'item', 
							label: 'Executar no Terminal', 
							icon: <span className="codicon codicon-play" />, 
							disabled: !isRunnableFile(menu.target),
							onClick: () => onRunFile?.(menu.target) 
						},
						{ type: 'separator' },
						terminalAction,
						{ type: 'separator' },
						...common
					];
				})()}
				onClose={() => setMenu({ open: false, x: 0, y: 0, target: null, isFolder: false })}
			/>
		</div>
	);
}

