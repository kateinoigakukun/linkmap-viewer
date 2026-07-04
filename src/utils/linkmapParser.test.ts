import { describe, expect, it } from 'vitest';
import { createTreemapData, parseLinkmap } from './linkmapParser';
import { formatBytes, assignTreemapColors, treemapColorKey } from './format';
import { buildPathTree, parseInputPath, aggregateValues, pathSegmentsFromTreePath, treePathForSegments, mergeTreePath } from './pathTree';
import type { TreemapNode } from '../types/linkmap';

describe('buildPathTree', () => {
  it('groups objects by directory path', () => {
    const tree = buildPathTree([
      {
        name: 'a',
        path: '/project/src/a.o',
        size: 100,
        symbols: [{ name: 'one', size: 100 }],
      },
      {
        name: 'b',
        path: '/project/src/deep/b.o',
        size: 200,
        symbols: [{ name: 'two', size: 200 }],
      },
    ]);
    aggregateValues(tree);

    expect(tree.value).toBe(300);
    expect(tree.children?.length).toBeGreaterThan(0);
  });

  it('parses archive members into path components', () => {
    expect(parseInputPath('/opt/libswiftCore.a(Swift.o)')).toEqual(['opt', 'libswiftCore.a', 'Swift']);
  });

  it('groups archive members under the archive library', () => {
    const tree = buildPathTree([
      {
        name: 'Swift',
        path: '/opt/libswiftCore.a(Swift.o)',
        size: 100,
        symbols: [{ name: 'one', size: 100 }],
      },
      {
        name: 'Metadata',
        path: '/opt/libswiftCore.a(Metadata.o)',
        size: 200,
        symbols: [{ name: 'two', size: 200 }],
      },
    ]);

    expect(tree.name).toContain('libswiftCore.a');
    expect(tree.children?.map((child) => child.name)).toEqual(['Swift', 'Metadata']);
  });

  it('maps path segments back to tree path', () => {
    const root: TreemapNode = {
      name: 'root',
      children: [
        {
          name: 'Library/org.swift.swiftpm',
          children: [{ name: 'swift-sdks/wasi', value: 10 }],
        },
      ],
    };

    expect(treePathForSegments(root, ['Library'])).toEqual(['Library/org.swift.swiftpm']);
    expect(treePathForSegments(root, ['Library', 'org.swift.swiftpm', 'swift-sdks', 'wasi'])).toEqual([
      'Library/org.swift.swiftpm',
      'swift-sdks/wasi',
    ]);
    expect(pathSegmentsFromTreePath(['Library/org.swift.swiftpm', 'swift-sdks/wasi'])).toEqual([
      'Library',
      'org.swift.swiftpm',
      'swift-sdks',
      'wasi',
    ]);
  });

  it('merges tree paths without duplicating overlapping levels', () => {
    expect(
      mergeTreePath(
        ['Library/org.swift.swiftpm', 'swift-sdks/wasi'],
        ['swift-sdks/wasi', 'libswiftCore.a', 'Swift'],
      ),
    ).toEqual(['Library/org.swift.swiftpm', 'swift-sdks/wasi', 'libswiftCore.a', 'Swift']);
  });
});

describe('createTreemapData', () => {
  it('builds a path tree for treemap', () => {
    const parsed = parseLinkmap(`    Addr      Off     Size Out     In      Symbol
       -        0       10         /src/a.o:(one)
       -        0       20         /src/a.o:(two)
       -        0       40         /lib/b.o:(three)`);

    const treemap = createTreemapData(parsed);

    expect(treemap.children.length).toBeGreaterThan(0);
    expect(treemap.totalSize).toBe(0x10 + 0x20 + 0x40);
    expect(treemap.objectCount).toBe(2);
    expect(treemap.symbolCount).toBe(3);
  });
});

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(512)).toBe('512 bytes');
    expect(formatBytes(2048)).toBe('2.0 kb');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 mb');
  });
});

describe('assignTreemapColors', () => {
  it('assigns distinct gradual hues to nested nodes', () => {
    const root = {
      name: 'root',
      value: 100,
      children: [
        {
          name: 'a',
          value: 50,
          children: [
            { name: 'a1', value: 25 },
            { name: 'a2', value: 25 },
          ],
        },
        { name: 'b', value: 50 },
      ],
    };

    assignTreemapColors(root);

    expect(root.children?.[0]?.color).toBeDefined();
    expect(root.children?.[1]?.color).toBeDefined();
    expect(root.children?.[0]?.children?.[0]?.color).toBeDefined();
    expect(root.children?.[0]?.children?.[1]?.color).toBeDefined();
    expect(root.children?.[0]?.color).not.toBe(root.children?.[1]?.color);
    expect(root.children?.[0]?.children?.[0]?.color).not.toBe(
      root.children?.[0]?.children?.[1]?.color,
    );
  });

  it('builds lookup keys for zoomed paths', () => {
    expect(treemapColorKey(['src'], ['deep/b'])).toBe('src/deep/b');
    expect(treemapColorKey([], ['src', 'a'])).toBe('src/a');
  });
});
