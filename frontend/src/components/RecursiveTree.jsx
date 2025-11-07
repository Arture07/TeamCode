// frontend/src/components/RecursiveTree.jsx
import React, { useMemo, useState, useCallback } from 'react';
import VSCodeContextMenu from './VSCodeContextMenu';

// Tree node renderer. Expects a TreeNode root with children.
// Props:
// - root: { name, type: 'folder'|'file', content?, children? }
// - selectedPath: string | null
// - onSelectFile(path)
// - onMove(from, toFolder)
// - onCreate({ parentPath, type: 'file'|'folder' }) optional
// - onDelete(path) optional
export default function RecursiveTree({ root, selectedPath, onSelectFile, onMove, onCreate, onDelete, onRename, onDuplicate }) {
	const [expanded, setExpanded] = useState(() => new Set(['']));
    const [menu, setMenu] = useState({ open: false, x: 0, y: 0, target: null, isFolder: false });
	const [selection, setSelection] = useState(() => new Set()); // multi-select set of full paths
	const [focused, setFocused] = useState(null);
	const [lastClicked, setLastClicked] = useState(null);

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

			const onDragStart = (e) => {
				e.stopPropagation();
				try { e.dataTransfer.setData('text/plain', fullPath); } catch {}
			};
		const onDragOver = (e) => { if (isFolder) e.preventDefault(); };
		const onDrop = (e) => {
			if (!isFolder) return;
			e.preventDefault(); e.stopPropagation();
			const from = e.dataTransfer.getData('text/plain');
			if (from && typeof onMove === 'function') onMove(from, fullPath);
		};

		const row = (
			<div
				key={fullPath || '(root)'}
				className={`flex items-center px-2 py-1 text-sm select-none rounded hover:bg-[var(--primary-bg-color)] ${selectedPath === fullPath ? 'bg-sky-900/30' : ''} ${selection.has(fullPath) ? 'ring-2 ring-[var(--primary-color)] bg-[var(--primary-bg-color)]' : ''}`}
				data-path={fullPath}
				onClick={(e) => {
					e.stopPropagation();
					const isRange = e.shiftKey; const isToggle = e.ctrlKey || e.metaKey;
					if (isRange) {
						// true range selection based on visibleNodes
						const last = lastClicked || (selection.size ? Array.from(selection).slice(-1)[0] : fullPath);
						const i1 = Math.max(0, visibleNodes.findIndex(n => n.path === last));
						const i2 = Math.max(0, visibleNodes.findIndex(n => n.path === fullPath));
						if (i1 >= 0 && i2 >= 0) {
							const [start, end] = i1 <= i2 ? [i1, i2] : [i2, i1];
							const range = new Set(visibleNodes.slice(start, end + 1).map(n => n.path));
							setSelection(range);
						} else {
							setSelection(prev => new Set([...prev, fullPath]));
						}
					} else if (isToggle) {
						setSelection(prev => { const s = new Set(prev); s.has(fullPath) ? s.delete(fullPath) : s.add(fullPath); return s; });
					} else {
						setSelection(new Set([fullPath]));
					}
					setLastClicked(fullPath);
					setFocused(fullPath);
					if (isFolder) toggle(fullPath); else if (typeof onSelectFile === 'function') onSelectFile(fullPath);
				}}
				onDragOver={onDragOver}
				onDrop={onDrop}
						draggable
				onDragStart={onDragStart}
				onContextMenu={(e) => {
					e.preventDefault(); e.stopPropagation();
					setMenu({ open: true, x: e.clientX, y: e.clientY, target: fullPath, isFolder });
				}}
			>
				{/* Chevron */}
				{isFolder ? (
					<span className={`inline-block w-4 text-xs mr-1 codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
				) : (
					<span className="inline-block w-4 mr-1" />
				)}
				{/* Icon */}
				<span className="mr-2 text-muted">{isFolder ? <span className="codicon codicon-folder" /> : <span className="codicon codicon-file" />}</span>
				{/* Name */}
				<span className={`truncate ${focused === fullPath ? 'focused-row' : ''}`}>{node.name || '/'}</span>
			</div>
		);

		if (!isFolder || !isExpanded) return row;
		const children = Array.isArray(node.children) ? node.children : [];
		return (
			<div key={`${fullPath}-block`}>
				{row}
				<div className="ml-4">
					{children.map((c) => renderNode(c, fullPath))}
				</div>
			</div>
		);
	};

	const rootChildren = useMemo(() => Array.isArray(root?.children) ? root.children : [], [root]);
	return (
		<div className="text-[var(--text-color)]">
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
							const segs = path.split('/');
							const base = segs.pop();
							const parent = segs.join('/');
							const node = visibleNodes.find(n => n.path === path);
							if (!node) return;
							if (node.isFolder) {
								onDuplicate?.(path);
							} else {
								const dot = base.lastIndexOf('.');
								const name = dot>0 ? base.slice(0,dot) : base;
								const ext = dot>0 ? base.slice(dot) : '';
								const newBase = `${name} copy${ext}`;
								onDuplicate?.(path, newBase);
							}
						} },
						{ type: 'item', label: 'Copiar Caminho', icon: <span className="codicon codicon-clippy" />, onClick: async () => { try { await navigator.clipboard.writeText(menu.target); } catch(_){} } },
						{ type: 'item', label: 'Copiar Relativo', icon: <span className="codicon codicon-clippy" />, onClick: async () => { try { const parts = menu.target.split('/'); await navigator.clipboard.writeText(parts[parts.length-1] || menu.target); } catch(_){} } },
						{ type: 'item', label: 'Revelar no explorer', icon: <span className="codicon codicon-go-to-file" />, onClick: () => {
							// Expand ancestors to reveal
							const parts = menu.target.split('/');
							let acc = '';
							setExpanded(prev => { const n = new Set(prev); for (let i=0;i<parts.length-1;i++){ acc = acc ? `${acc}/${parts[i]}` : parts[i]; n.add(acc);} return n; });
							setFocused(menu.target);
							// Scroll into view next tick
							setTimeout(() => { try { document.querySelector(`[data-path="${CSS.escape(menu.target)}"]`)?.scrollIntoView({ block: 'nearest' }); } catch(_){} }, 0);
						} },
					];
					if (menu.isFolder) {
						return [
							{ type: 'item', label: 'Novo Arquivo', shortcut: 'A', icon: <span className="codicon codicon-new-file" />, onClick: () => onCreate?.({ parentPath: menu.target, type: 'file' }) },
							{ type: 'item', label: 'Nova Pasta', shortcut: 'Shift+A', icon: <span className="codicon codicon-new-folder" />, onClick: () => onCreate?.({ parentPath: menu.target, type: 'folder' }) },
							{ type: 'separator' },
							...common,
						];
					}
					return common;
				})()}
				onClose={() => setMenu({ open: false, x: 0, y: 0, target: null, isFolder: false })}
			/>
		</div>
	);
}

