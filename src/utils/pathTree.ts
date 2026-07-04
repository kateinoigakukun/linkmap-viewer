import type { LinkmapObject, TreemapNode } from '../types/linkmap';

export function parseInputPath(raw: string): string[] {
  if (!raw || raw.startsWith('<internal>')) {
    return ['<internal>'];
  }

  let path = raw;
  let archiveMember: string | undefined;

  if (raw.endsWith(')') && raw.includes('(')) {
    const index = raw.lastIndexOf('(');
    archiveMember = raw.slice(index + 1, -1);
    path = raw.slice(0, index);
  }

  const components = path.split('/').filter(Boolean);

  if (archiveMember) {
    const member = archiveMember.endsWith('.o') ? archiveMember.slice(0, -2) : archiveMember;
    if (!components.length) {
      components.push(path);
    }
    components.push(member);
    return components;
  }

  if (components.length) {
    const last = components[components.length - 1];
    if (last.endsWith('.o')) {
      components[components.length - 1] = last.slice(0, -2);
    }
  }

  return components;
}

export function collapseSingleChildren(node: TreemapNode): TreemapNode {
  if (!node.children?.length) {
    return node;
  }

  if (node.children.length === 1) {
    const child = collapseSingleChildren(node.children[0]);
    return {
      ...child,
      name: `${node.name}/${child.name}`,
      inputPath: child.inputPath,
    };
  }

  return {
    ...node,
    children: node.children.map(collapseSingleChildren),
  };
}

export function buildPathTree(objects: LinkmapObject[]): TreemapNode {
  const prefix = commonPathPrefix(objects.map((object) => object.path));
  const root: TreemapNode = { name: 'linkmap', children: [] };

  for (const object of objects) {
    if (object.size <= 0) continue;

    const strippedPath = stripCommonPrefix(object.path, prefix);
    const components = parseInputPath(strippedPath);
    let current = root;
    let inputPath = '';

    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const isLast = i === components.length - 1;
      inputPath += (i === 0 ? '' : '/') + component;

      if (!current.children) current.children = [];
      let child = current.children.find((entry) => entry.name === component);
      if (!child) {
        child = {
          name: component,
          inputPath: isLast ? object.path : inputPath,
          children: isLast ? undefined : [],
        };
        current.children.push(child);
      }

      if (isLast) {
        child.value = (child.value ?? 0) + object.size;
        child.inputPath = object.path;
        child.symbols = object.symbols
          .filter((symbol) => symbol.size > 0)
          .sort((a, b) => b.size - a.size)
          .slice(0, 50)
          .map((symbol) => ({
            name: symbol.name,
            value: symbol.size,
            section: symbol.section,
          }));
      } else {
        if (!child.inputPath) child.inputPath = inputPath;
        if (!child.children) child.children = [];
        current = child;
      }
    }
  }

  const collapsed = collapseSingleChildren(root);
  const unwrapped = unwrapCommonRootChildren(collapsed);
  return {
    ...unwrapped,
    children: unwrapped.children ?? [],
  };
}

function unwrapCommonRootChildren(node: TreemapNode): TreemapNode {
  let current = node;

  while (current.children?.length === 1 && current.children[0].children?.length) {
    const child = current.children[0];
    current = {
      ...child,
      name: current.name === 'linkmap' ? child.name : `${current.name}/${child.name}`,
    };
  }

  return current;
}

function commonPathPrefix(paths: string[]): string {
  const filePaths = paths.filter((path) => path.startsWith('/'));
  if (filePaths.length === 0) return '';

  const splitPaths = filePaths.map((path) => path.split('/').filter(Boolean));
  const prefixParts: string[] = [];

  for (let index = 0; ; index++) {
    const part = splitPaths[0][index];
    if (!part || splitPaths.some((parts) => parts[index] !== part)) {
      break;
    }
    prefixParts.push(part);
  }

  return prefixParts.length ? `/${prefixParts.join('/')}` : '';
}

function stripCommonPrefix(path: string, prefix: string): string {
  if (!prefix || !path.startsWith(prefix)) return path;
  const rest = path.slice(prefix.length);
  if (!rest || rest === '/') return path;
  return rest.startsWith('/') ? rest : `/${rest}`;
}

export function aggregateValues(node: TreemapNode): number {
  if (node.children?.length) {
    const total = node.children.reduce((sum, child) => sum + aggregateValues(child), 0);
    node.value = total;
    return total;
  }
  return node.value ?? 0;
}

export function findNodeByPath(root: TreemapNode, path: string[]): TreemapNode | null {
  if (path.length === 0) return root;
  const [head, ...rest] = path;
  const child = root.children?.find((entry) => entry.name === head);
  if (!child) return null;
  return rest.length === 0 ? child : findNodeByPath(child, rest);
}

function splitNodeName(name: string): string[] {
  return name.split('/').filter(Boolean);
}

export function pathSegmentsFromTreePath(treePath: string[]): string[] {
  return treePath.flatMap(splitNodeName);
}

export function mergeTreePath(treePath: string[], suffix: string[]): string[] {
  if (treePath.length === 0) return suffix;
  if (suffix.length === 0) return treePath;

  let overlap = 0;
  for (let len = 1; len <= Math.min(treePath.length, suffix.length); len++) {
    const treeTail = treePath.slice(treePath.length - len);
    const suffixHead = suffix.slice(0, len);
    if (treeTail.every((value, index) => value === suffixHead[index])) {
      overlap = len;
    }
  }

  return [...treePath, ...suffix.slice(overlap)];
}

export function treePathForSegments(root: TreemapNode, segments: string[]): string[] {
  const treePath: string[] = [];
  let index = 0;
  let current: TreemapNode = root;

  while (index < segments.length && current.children?.length) {
    const child = current.children.find((entry) => {
      const parts = splitNodeName(entry.name);
      const remaining = segments.length - index;
      const compareLength = Math.min(parts.length, remaining);
      return (
        compareLength > 0 &&
        parts.slice(0, compareLength).every((part, partIndex) => part === segments[index + partIndex])
      );
    });

    if (!child) break;

    treePath.push(child.name);
    index += splitNodeName(child.name).length;
    current = child;
  }

  return treePath;
}

export function resolveTreePath(root: TreemapNode, treePath: string[]): TreemapNode | null {
  if (treePath.length === 0) return null;

  let current: TreemapNode = root;
  for (const name of treePath) {
    const child = current.children?.find((entry) => entry.name === name);
    if (!child) return null;
    current = child;
  }

  return current;
}
