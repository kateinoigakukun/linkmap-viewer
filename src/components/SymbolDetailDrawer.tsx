import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { SymbolDetail } from '../types/linkmap';
import { formatBytes } from '../utils/format';
import { SymbolDemanglerContext } from './SymbolDemanglerContext';

interface SymbolDetailDrawerProps {
  detail: SymbolDetail | null;
  onClose: () => void;
  onHeightChange?: (height: number) => void;
}

const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.75;

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function clampHeight(height: number): number {
  const maxHeight = Math.max(MIN_HEIGHT, Math.round(window.innerHeight * MAX_HEIGHT_RATIO));
  return Math.min(maxHeight, Math.max(MIN_HEIGHT, height));
}

export default function SymbolDetailDrawer({ detail, onClose, onHeightChange }: SymbolDetailDrawerProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [demangledName, setDemangledName] = useState<string | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const demangler = useContext(SymbolDemanglerContext);

  useEffect(() => {
    onHeightChange?.(detail ? height : 0);
  }, [detail, height, onHeightChange]);

  // A symbol can be opened before the treemap's own request for its object has resolved, so ask
  // for this one name too. Reports carry `displayName` already and have no demangler at all.
  useEffect(() => {
    setDemangledName(null);
    if (!detail || detail.displayName || !demangler) return;

    const cached = demangler.lookup(detail.name);
    if (cached !== undefined) {
      setDemangledName(cached);
      return;
    }

    let cancelled = false;
    void demangler.request([detail.name]).then(() => {
      if (!cancelled) setDemangledName(demangler.lookup(detail.name) ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [detail, demangler]);

  useEffect(() => {
    if (!detail) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detail, onClose]);

  const stopResize = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - event.clientY;
      setHeight(clampHeight(dragRef.current.startHeight + delta));
    };

    const onMouseUp = () => stopResize();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      stopResize();
    };
  }, [stopResize]);

  const onResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startHeight: height };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  if (!detail) return null;

  const title = detail.displayName ?? demangledName ?? detail.name;
  const showRawSymbol = title !== detail.name;

  return (
    <aside
      className="symbol-drawer"
      data-testid="symbol-drawer"
      aria-labelledby="symbol-drawer-title"
      style={{ height: `${height}px` }}
    >
      <div
        className="symbol-drawer-resizer"
        data-testid="symbol-drawer-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize symbol details panel"
        onMouseDown={onResizeStart}
      />
      <div className="symbol-drawer-body">
        <div className="symbol-drawer-header">
          <h3 id="symbol-drawer-title" className="symbol-drawer-title">
            {title}
          </h3>
          <button
            type="button"
            className="symbol-drawer-close"
            aria-label="Close symbol details"
            data-testid="symbol-drawer-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {showRawSymbol && (
          <p>
            <b>Raw symbol</b>
            <br />
            <code>{detail.name}</code>
          </p>
        )}
        <p>
          <b>Size</b> {formatBytes(detail.size)} ({formatPercent(detail.size, detail.objectSize)})
        </p>
        {detail.section && (
          <p>
            <b>Section</b> {detail.section}
          </p>
        )}
        <p>
          <b>Object file</b>
          <br />
          <code>{detail.objectPath}</code>
        </p>
      </div>
    </aside>
  );
}
