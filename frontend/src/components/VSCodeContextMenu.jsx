// frontend/src/components/VSCodeContextMenu.jsx
import React, { useEffect, useRef } from 'react';

// VS Code–style context menu
// Props:
// - x, y: screen coordinates
// - open: boolean
// - items: [{ type: 'item'|'separator', label, shortcut?, danger?, disabled?, onClick, icon? }]
// - onClose: () => void
export default function VSCodeContextMenu({ x = 0, y = 0, open, items = [], onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('contextmenu', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('contextmenu', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // prevent the menu from going off-screen
  const style = {
    left: Math.max(8, x),
    top: Math.max(8, y),
  };

  return (
    <div className="vsc-menu" style={style} ref={ref} role="menu">
      {items.map((it, idx) => {
        if (it.type === 'separator') {
          return <div key={idx} className="vsc-menu-sep" />;
        }
        const classes = [
          'vsc-menu-item',
          it.danger ? 'danger' : '',
          it.disabled ? 'disabled' : '',
        ].join(' ');
        return (
          <button
            key={idx}
            className={classes}
            onClick={() => { if (!it.disabled) { it.onClick?.(); onClose?.(); } }}
            role="menuitem"
          >
            <span className="vsc-menu-icon">{it.icon || ''}</span>
            <span className="vsc-menu-label">{it.label}</span>
            {it.shortcut && <span className="vsc-menu-shortcut">{it.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
