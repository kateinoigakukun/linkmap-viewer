import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import type { SymbolDetail, TreemapData, TreemapNode } from '../types/linkmap';
import { nodeForZoom } from '../utils/linkmapParser';
import {
  mergeTreePath,
  resolveTreePath,
} from '../utils/pathTree';
import { formatBytes, treemapNodeColor } from '../utils/format';
import { SymbolDemanglerContext } from './SymbolDemanglerContext';
import SymbolDetailDrawer from './SymbolDetailDrawer';

interface TreemapProps {
  data: TreemapData;
}

const HEADER_HEIGHT = 20;
const PADDING = 4;
const INSET_X = PADDING * 2;
const INSET_Y = HEADER_HEIGHT + PADDING;

type RectNode = d3.HierarchyRectangularNode<TreemapNode>;

interface TooltipState {
  x: number;
  y: number;
  path: string;
  name: string;
  size: number;
}

interface BreadcrumbCrumb {
  label: string;
  treePathIndex: number;
}

function buildBreadcrumbs(treePath: string[]): BreadcrumbCrumb[] {
  return treePath.map((label, treePathIndex) => ({ label, treePathIndex }));
}

function compactBreadcrumbs(treePath: string[]): BreadcrumbCrumb[] {
  const maxTail = 3;

  if (treePath.length <= maxTail) {
    return buildBreadcrumbs(treePath);
  }

  const ellipsisIndex = treePath.length - maxTail - 1;
  return [
    { label: '…', treePathIndex: ellipsisIndex },
    ...buildBreadcrumbs(treePath).slice(treePath.length - maxTail),
  ];
}

function nextTreePath(currentPath: string[], relative: string[]): string[] | null {
  if (relative.length === 0) return null;
  return mergeTreePath(currentPath, relative);
}

function formatTooltipPath(path: string, name: string): { prefix: string; leaf: string } {
  let leaf: string;
  let prefix: string;

  if (path.endsWith(name)) {
    leaf = name;
    prefix = path.slice(0, path.length - name.length);
  } else {
    const parts = path.split('/');
    leaf = parts.pop() ?? path;
    prefix = parts.length ? `${parts.join('/')}/` : '';
  }

  if (prefix.length > 48) {
    prefix = shortenMiddle(prefix, 48);
  }

  return { prefix, leaf };
}

function shortenMiddle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const head = Math.ceil((maxLen - 1) / 2);
  const tail = Math.floor((maxLen - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function clampTooltipPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const margin = 8;
  let left = x;
  let top = y + 16;

  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - margin - width;
  }
  if (left < margin) left = margin;

  if (top + height > window.innerHeight - margin) {
    top = y - height - 12;
  }
  if (top < margin) top = margin;

  return { x: left, y: top };
}

export default function Treemap({ data }: TreemapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [treePath, setTreePath] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolDetail | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [demangleTick, setDemangleTick] = useState(0);
  const [viewportTick, setViewportTick] = useState(0);
  const demangler = useContext(SymbolDemanglerContext);

  const dataRoot = useMemo(
    (): TreemapNode => ({
      name: data.name,
      value: data.totalSize,
      children: data.children,
    }),
    [data],
  );

  const focusedNode = useMemo(
    () => resolveTreePath(dataRoot, treePath),
    [dataRoot, treePath],
  );

  const viewRoot = useMemo((): TreemapNode => {
    if (!focusedNode) {
      return dataRoot;
    }

    if (focusedNode.children?.length) {
      return focusedNode;
    }

    const expanded = nodeForZoom(focusedNode);
    if (expanded?.children?.length) {
      return expanded;
    }

    return focusedNode;
  }, [dataRoot, focusedNode]);

  const symbolViewObject = useMemo((): TreemapNode | null => {
    if (!focusedNode || focusedNode.children?.length || !focusedNode.symbols?.length) {
      return null;
    }
    return focusedNode;
  }, [focusedNode]);

  useEffect(() => {
    setTreePath([]);
    setTooltip(null);
    setSelectedSymbol(null);
  }, [data]);

  // Symbol names are only shown once an object is focused, so that is the only point at which
  // they need demangling -- one object's worth at a time, rather than the whole tree up front.
  useEffect(() => {
    if (!demangler || !symbolViewObject?.symbols?.length) return;

    const names = symbolViewObject.symbols
      .filter((symbol) => !symbol.displayName)
      .map((symbol) => symbol.name);
    if (names.length === 0) return;

    let cancelled = false;
    void demangler.request(names).then(() => {
      if (!cancelled) setDemangleTick((tick) => tick + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [demangler, symbolViewObject]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      setTooltipPos(null);
      return;
    }

    const el = tooltipRef.current;
    const { x, y } = clampTooltipPosition(
      tooltip.x,
      tooltip.y,
      el.offsetWidth,
      el.offsetHeight,
    );
    setTooltipPos({ x, y });
  }, [tooltip]);

  useEffect(() => {
    if (!svgRef.current || !hostRef.current || !viewRoot.children?.length) return;

    const width = Math.min(hostRef.current.clientWidth, 1600);
    const { top } = hostRef.current.getBoundingClientRect();
    const availableHeight = window.innerHeight - top - 32;
    const height = Math.max(320, Math.round(availableHeight));
    const svg = d3.select(svgRef.current);
    const layoutRoot = viewRoot;

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);
    svg.attr('data-testid', 'treemap-svg');

    const root = d3
      .hierarchy(layoutRoot)
      .sum((d) => (d.children?.length ? 0 : d.value) ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3
      .treemap<TreemapNode>()
      .tile(d3.treemapSquarify.ratio(1))
      .size([width, height])
      .paddingInner(PADDING)
      .paddingTop((node) => (node.children ? HEADER_HEIGHT : 0))
      .round(true)(root);

    const nodes = root.descendants().filter((d) => d.depth > 0) as RectNode[];
    const colorFor = (node: RectNode): string => treemapNodeColor(node.data);
    const displayNameOf = (node: TreemapNode): string =>
      node.displayName ?? demangler?.lookup(node.name) ?? node.name;

    const cell = svg
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cell.each(function (node) {
      const group = d3.select(this);
      const w = Math.max(0, node.x1 - node.x0);
      const h = Math.max(0, node.y1 - node.y0);
      const color = colorFor(node);
      const isParent = !!node.children?.length;
      const fullNode = resolveTreePath(dataRoot, mergeTreePath(treePath, relativeTreeNames(node)));
      const canZoom = !!fullNode && !!nodeForZoom(fullNode);
      const isSymbolCell = !!symbolViewObject && !isParent;

      if (isParent) {
        group
          .append('rect')
          .attr('width', w)
          .attr('height', Math.min(HEADER_HEIGHT, h))
          .attr('fill', color);
        if (h > INSET_Y) {
          group
            .append('rect')
            .attr('y', HEADER_HEIGHT)
            .attr('width', PADDING)
            .attr('height', h - INSET_Y)
            .attr('fill', color);
          group
            .append('rect')
            .attr('x', w - PADDING)
            .attr('y', HEADER_HEIGHT)
            .attr('width', PADDING)
            .attr('height', h - INSET_Y)
            .attr('fill', color);
        }
        if (h > HEADER_HEIGHT) {
          group
            .append('rect')
            .attr('y', h - PADDING)
            .attr('width', w)
            .attr('height', PADDING)
            .attr('fill', color);
        }
      } else {
        group.append('rect').attr('width', w).attr('height', h).attr('fill', color);
      }

      group
        .append('rect')
        .attr('class', 'hit')
        .attr('width', w)
        .attr('height', h)
        .attr('fill', 'transparent')
        .attr('stroke', '#222')
        .attr('stroke-width', 0.5)
        .style('cursor', canZoom || isSymbolCell ? 'pointer' : 'default');

      group
        .append('rect')
        .attr('class', 'hover')
        .attr('width', w)
        .attr('height', h)
        .attr('fill', 'rgba(255,255,255,0.5)')
        .attr('pointer-events', 'none')
        .style('display', 'none');

      if (h >= HEADER_HEIGHT) {
        const rawName = node.data.name;
        const label = isParent
          ? `${rawName} – ${formatBytes(node.value ?? 0)}`
          : symbolViewObject
            ? displayNameOf(node.data)
            : rawName;
        group
          .append('text')
          .attr('x', w / 2)
          .attr('y', isParent ? HEADER_HEIGHT / 2 : Math.min(HEADER_HEIGHT / 2, h / 2))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 14)
          .attr('fill', '#000')
          .attr('pointer-events', 'none')
          .text(truncateLabel(label, w - INSET_X));
      }

      if (!isParent && h > INSET_Y + 16) {
        group
          .append('text')
          .attr('x', w / 2)
          .attr('y', HEADER_HEIGHT + (h - HEADER_HEIGHT) / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 14)
          .attr('fill', '#000')
          .attr('opacity', 0.5)
          .attr('pointer-events', 'none')
          .text(truncateLabel(formatBytes(node.value ?? 0), w - INSET_X));
      }
    });

    cell
      .select('.hit')
      .on('mousemove', function (event: MouseEvent, node) {
        cell.select('.hover').style('display', 'none');
        const parent = (this as Element).parentNode as Element;
        d3.select(parent).select('.hover').style('display', 'block');

        const path = node.data.inputPath ?? node.data.name;
        const tooltipName =
          symbolViewObject && !node.children?.length
            ? displayNameOf(node.data)
            : node.data.name;
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          path,
          name: tooltipName,
          size: node.value ?? 0,
        });
      })
      .on('mouseleave', function () {
        const parent = (this as Element).parentNode as Element;
        d3.select(parent).select('.hover').style('display', 'none');
        setTooltip(null);
      })
      .on('click', (event, node) => {
        event.stopPropagation();

        if (symbolViewObject && !node.children?.length) {
          setSelectedSymbol({
            name: node.data.name,
            displayName: node.data.displayName ?? demangler?.lookup(node.data.name),
            size: node.value ?? 0,
            section: node.data.section,
            objectPath: symbolViewObject.inputPath ?? symbolViewObject.name,
            objectSize: symbolViewObject.value ?? 0,
            color: node.data.color,
          });
          setTooltip(null);
          return;
        }

        const targetPath = nextTreePath(treePath, relativeTreeNames(node));
        if (!targetPath) return;

        const fullNode = resolveTreePath(dataRoot, targetPath);
        const zoomTarget = fullNode ? nodeForZoom(fullNode) : null;
        if (zoomTarget) {
          setTreePath(targetPath);
          setSelectedSymbol(null);
          setTooltip(null);
        }
      });
  }, [viewRoot, treePath, viewportTick, dataRoot, symbolViewObject, demangler, demangleTick]);

  useEffect(() => {
    const onResize = () => setViewportTick((tick) => tick + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (data.children.length === 0) {
    return <p className="center">No objects found in this linkmap.</p>;
  }

  const tooltipParts = tooltip ? formatTooltipPath(tooltip.path, tooltip.name) : null;
  const breadcrumbs = compactBreadcrumbs(treePath);
  const atRoot = treePath.length === 0;

  return (
    <div
      className="treemap-panel"
      style={drawerHeight > 0 ? { paddingBottom: drawerHeight } : undefined}
    >
      <nav className="treemap-breadcrumb" aria-label="Path" data-testid="treemap-breadcrumb">
        {atRoot ? (
          <span className="treemap-breadcrumb-current">/</span>
        ) : (
          <>
            <button
              type="button"
              className="treemap-breadcrumb-link treemap-breadcrumb-root"
              title="Show all"
              onClick={() => {
                setTreePath([]);
                setSelectedSymbol(null);
              }}
            >
              /
            </button>
            {breadcrumbs.map((crumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;
              const isEllipsis = crumb.label === '…';
              const label = isEllipsis ? crumb.label : shortenMiddle(crumb.label, 32);

              return (
                <span
                  key={`${crumb.treePathIndex}-${crumb.label}-${index}`}
                  className="treemap-breadcrumb-item"
                >
                  {index > 0 && <span className="treemap-breadcrumb-sep">/</span>}
                  {isCurrent ? (
                    <span className="treemap-breadcrumb-current" title={crumb.label}>
                      {label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`treemap-breadcrumb-link${isEllipsis ? ' fixed' : ''}`}
                      title={isEllipsis ? 'Show more' : crumb.label}
                      onClick={() => {
                        setTreePath(treePath.slice(0, crumb.treePathIndex + 1));
                        setSelectedSymbol(null);
                      }}
                    >
                      {label}
                    </button>
                  )}
                </span>
              );
            })}
          </>
        )}
      </nav>
      <div className="treemap-host" ref={hostRef}>
        <main>
          <svg ref={svgRef} />
        </main>
      </div>
      {tooltip &&
        tooltipParts &&
        createPortal(
          <div
            ref={tooltipRef}
            className="tooltip"
            data-testid="treemap-tooltip"
            title={tooltip.path}
            style={{
              left: tooltipPos?.x ?? -9999,
              top: tooltipPos?.y ?? -9999,
              visibility: tooltipPos ? 'visible' : 'hidden',
            }}
          >
            <b className="tooltip-size">{formatBytes(tooltip.size)}</b>
            <span className="tooltip-path">
              {tooltipParts.prefix && (
                <span className="tooltip-prefix">{tooltipParts.prefix}</span>
              )}
              <b className="tooltip-leaf">{tooltipParts.leaf}</b>
            </span>
          </div>,
          document.body,
        )}
      <SymbolDetailDrawer
        detail={selectedSymbol}
        onClose={() => setSelectedSymbol(null)}
        onHeightChange={setDrawerHeight}
      />
    </div>
  );
}

function relativeTreeNames(rectNode: RectNode): string[] {
  const names: string[] = [];
  let current: RectNode | null = rectNode;

  while (current && current.depth > 0) {
    names.unshift(current.data.name);
    current = current.parent as RectNode;
  }

  return names;
}

function truncateLabel(text: string, maxWidth: number): string {
  const approx = Math.max(0, Math.floor(maxWidth / 7));
  if (text.length <= approx) return text;
  return `${text.slice(0, Math.max(0, approx - 3))}...`;
}
