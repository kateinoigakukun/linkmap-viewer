export function formatInteger(value: number): string {
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 1) return '1 byte';
  if (bytes < 1024) return `${formatInteger(bytes)} bytes`;
  if (bytes < 1024 * 1024) return `${formatNumberWithDecimal(bytes / 1024)} kb`;
  if (bytes < 1024 * 1024 * 1024) return `${formatNumberWithDecimal(bytes / (1024 * 1024))} mb`;
  return `${formatNumberWithDecimal(bytes / (1024 * 1024 * 1024))} gb`;
}

function formatNumberWithDecimal(value: number): string {
  const parts = value.toFixed(1).split('.', 2);
  return `${formatInteger(Number(parts[0]))}.${parts[1]}`;
}

export function hueAngleToColor(hueAngle: number): string {
  const saturation = 0.6 + 0.4 * Math.max(0, Math.cos(hueAngle));
  const lightness = 0.5 + 0.2 * Math.max(0, Math.cos(hueAngle + (Math.PI * 2) / 3));
  return `hsl(${(hueAngle * 180) / Math.PI}deg, ${Math.round(100 * saturation)}%, ${Math.round(100 * lightness)}%)`;
}

export interface TreemapColorNode {
  name: string;
  value?: number;
  color?: string;
  children?: TreemapColorNode[];
  symbols?: TreemapColorNode[];
}

export function assignTreemapColors(root: TreemapColorNode): void {
  assignTreemapColorsInPlace(root, 0, Math.PI * 2);
}

function orderBySize(a: TreemapColorNode, b: TreemapColorNode): number {
  return (b.value ?? 0) - (a.value ?? 0) || a.name.localeCompare(b.name);
}

function assignTreemapColorsInPlace(
  node: TreemapColorNode,
  startAngle: number,
  sweepAngle: number,
): void {
  node.color = hueAngleToColor(startAngle + sweepAngle / 2);

  if (node.children?.length) {
    const total = node.children.reduce((sum, child) => sum + (child.value ?? 0), 0) || 1;
    let angle = startAngle;
    for (const child of [...node.children].sort(orderBySize)) {
      const childSweep = ((child.value ?? 0) / total) * sweepAngle;
      assignTreemapColorsInPlace(child, angle, childSweep);
      angle += childSweep;
    }
    return;
  }

  if (node.symbols?.length && (node.value ?? 0) > 0) {
    const total = node.symbols.reduce((sum, symbol) => sum + (symbol.value ?? 0), 0) || 1;
    let angle = startAngle;
    for (const symbol of [...node.symbols].sort(orderBySize)) {
      const symbolSweep = ((symbol.value ?? 0) / total) * sweepAngle;
      symbol.color = hueAngleToColor(angle + symbolSweep / 2);
      angle += symbolSweep;
    }
  }
}

export function treemapNodeColor(node: TreemapColorNode): string {
  if (node.color) return node.color;

  let hash = 0;
  for (let index = 0; index < node.name.length; index++) {
    hash = (hash * 31 + node.name.charCodeAt(index)) | 0;
  }

  return hueAngleToColor((Math.abs(hash) % 360) * (Math.PI / 180));
}

export function treemapColorKey(treePath: string[], relativeNames: string[]): string {
  const prefix = treePath.join('/');
  const suffix = relativeNames.join('/');
  if (!prefix) return suffix;
  if (!suffix) return prefix;
  return `${prefix}/${suffix}`;
}
