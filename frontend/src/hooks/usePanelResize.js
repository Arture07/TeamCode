import { useState, useRef } from 'react';

const DEFAULT_PANEL_SIZES = { left: 20, center: 55, right: 25 };

export function usePanelResize(storageKey = 'teamcode-panel-sizes') {
  const [panelSizes, setPanelSizes] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return DEFAULT_PANEL_SIZES;
  });

  const dragInfo = useRef(null);

  const onMouseMove = (e) => {
    if (!dragInfo.current) return;
    const { divider, startX, initialSizes } = dragInfo.current;
    const deltaX = e.clientX - startX;
    if (Math.abs(deltaX) < 2) return;
    const totalWidth = window.innerWidth;
    const deltaPercent = (deltaX / totalWidth) * 100;

    const minLeftPx = 220;
    const minRightPx = 220;
    const minCenterPx = 300;

    const minLeft = Math.min(40, (minLeftPx / totalWidth) * 100);
    const minRight = Math.min(40, (minRightPx / totalWidth) * 100);
    const minCenter = Math.min(50, (minCenterPx / totalWidth) * 100);

    const maxLeft = 70;
    const maxRight = 70;

    let newLeft = initialSizes.left;
    let newRight = initialSizes.right;

    if (divider === 'left') {
      newLeft = Math.max(minLeft, Math.min(initialSizes.left + deltaPercent, maxLeft));
    } else {
      newRight = Math.max(minRight, Math.min(initialSizes.right - deltaPercent, maxRight));
    }

    let newCenter = 100 - newLeft - newRight;

    if (newCenter < minCenter) {
      const deficit = minCenter - newCenter;
      if (divider === 'left') {
        newRight = Math.max(minRight, newRight - deficit);
      } else {
        newLeft = Math.max(minLeft, newLeft - deficit);
      }
      newCenter = 100 - newLeft - newRight;
    }

    if (newCenter >= minCenter) {
      const sizes = { left: newLeft, center: newCenter, right: newRight };
      setPanelSizes(sizes);
      try {
        localStorage.setItem(storageKey, JSON.stringify(sizes));
      } catch (_) {}
    }
  };

  const onMouseUp = () => {
    dragInfo.current = null;
    try {
      document.body.style.cursor = '';
      document.body.classList.remove('no-transition');
    } catch (_) {}
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mouseleave', onMouseUp);
    window.removeEventListener('blur', onMouseUp);
  };

  const onMouseDown = (divider) => (e) => {
    dragInfo.current = {
      divider,
      startX: e.clientX,
      initialSizes: { ...panelSizes },
    };
    e.preventDefault();
    try {
      document.body.style.cursor = 'col-resize';
      document.body.classList.add('no-transition');
    } catch (_) {}
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', onMouseUp);
    window.addEventListener('blur', onMouseUp);
  };

  const onTouchStart = (divider) => (e) => {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    dragInfo.current = {
      divider,
      startX: touch.clientX,
      initialSizes: { ...panelSizes },
    };
    try {
      document.body.style.cursor = 'col-resize';
      document.body.classList.add('no-transition');
    } catch (_) {}
    const onTouchMove = (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      onMouseMove({ clientX: t.clientX });
    };
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onMouseUp);
  };

  const reset = () => {
    setPanelSizes(DEFAULT_PANEL_SIZES);
    try {
      localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PANEL_SIZES));
    } catch (_) {}
  };

  return { panelSizes, setPanelSizes, onMouseDown, onTouchStart, reset, DEFAULT_PANEL_SIZES };
}
