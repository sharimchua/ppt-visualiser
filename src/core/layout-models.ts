import {
  LayoutDefinition,
  LayoutNode,
  LayoutCellNode,
  LayoutContainerNode,
  LayoutMode,
  AestheticsConfig,
} from './types';

/**
 * Built-in Layout Presets
 */
export const PRESET_BALANCED: LayoutDefinition = {
  id: 'balanced',
  name: 'Balanced Duo',
  description: 'Concentric Pitch Clock paired with Live Note Stream ribbon',
  root: {
    id: 'root-balanced',
    type: 'container',
    direction: 'column',
    gap: 8,
    children: [
      {
        id: 'cell-clock-main',
        type: 'cell',
        module: 'orbital',
        flex: 3,
        title: 'Pitch Clock',
      },
      {
        id: 'cell-stream-bottom',
        type: 'cell',
        module: 'stream',
        flex: 1,
        minSize: 80,
        title: 'Note Stream',
        configOverrides: {
          orientation: 'horizontal',
          direction: 'rtl',
        },
      },
    ],
  },
};

export const PRESET_MONUMENT: LayoutDefinition = {
  id: 'monument',
  name: 'Clock Monument',
  description: 'Maximized Pitch Clock display with compact baseline stream',
  root: {
    id: 'root-monument',
    type: 'container',
    direction: 'column',
    gap: 6,
    children: [
      {
        id: 'cell-clock-monument',
        type: 'cell',
        module: 'orbital',
        flex: 5,
        title: 'Pitch Clock Monument',
      },
      {
        id: 'cell-stream-compact',
        type: 'cell',
        module: 'stream',
        flex: 1,
        minSize: 65,
        title: 'Compact Stream',
        configOverrides: {
          orientation: 'horizontal',
          direction: 'rtl',
        },
      },
    ],
  },
};

export const PRESET_RIVER: LayoutDefinition = {
  id: 'river',
  name: 'Stream River',
  description: 'Dominant horizontal scrolling stream with compact clock radar',
  root: {
    id: 'root-river',
    type: 'container',
    direction: 'column',
    gap: 8,
    children: [
      {
        id: 'cell-stream-river',
        type: 'cell',
        module: 'stream',
        flex: 3,
        title: 'Stream River',
        configOverrides: {
          orientation: 'horizontal',
          direction: 'rtl',
          streamMode: 'continuous',
        },
      },
      {
        id: 'cell-clock-radar',
        type: 'cell',
        module: 'orbital',
        flex: 2,
        title: 'Clock Radar',
      },
    ],
  },
};

export const PRESET_WATERFALL: LayoutDefinition = {
  id: 'waterfall',
  name: 'Waterfall Duo',
  description: 'Side-by-side: Pitch Clock on left with vertical top-to-bottom waterfall stream on right',
  root: {
    id: 'root-waterfall',
    type: 'container',
    direction: 'row',
    gap: 8,
    children: [
      {
        id: 'cell-clock-left',
        type: 'cell',
        module: 'orbital',
        flex: 3,
        title: 'Pitch Clock',
      },
      {
        id: 'cell-stream-waterfall',
        type: 'cell',
        module: 'stream',
        flex: 1,
        minSize: 180,
        title: 'Waterfall Stream',
        configOverrides: {
          orientation: 'vertical',
          direction: 'ttb', // Top-to-bottom waterfall
        },
      },
    ],
  },
};

export const PRESET_DUAL_STREAM: LayoutDefinition = {
  id: 'dual-stream',
  name: 'Dual Stream (Bass & Treble)',
  description: 'Center Pitch Clock flanked by Bass Stream and Treble Stream',
  root: {
    id: 'root-dual-stream',
    type: 'container',
    direction: 'row',
    gap: 8,
    children: [
      {
        id: 'cell-stream-bass',
        type: 'cell',
        module: 'stream',
        flex: 1,
        minSize: 150,
        title: 'Bass Waterfall',
        configOverrides: {
          orientation: 'vertical',
          direction: 'ttb',
          streamFilterRegister: 'bass',
        },
      },
      {
        id: 'cell-clock-center',
        type: 'cell',
        module: 'orbital',
        flex: 3,
        title: 'Pitch Clock',
      },
      {
        id: 'cell-stream-treble',
        type: 'cell',
        module: 'stream',
        flex: 1,
        minSize: 150,
        title: 'Treble Waterfall',
        configOverrides: {
          orientation: 'vertical',
          direction: 'btt', // Upward bubbling stream
          streamFilterRegister: 'treble',
        },
      },
    ],
  },
};

export const PRESET_ORBITAL_FOCUS: LayoutDefinition = {
  id: 'orbital-focus',
  name: 'Orbital Focus',
  description: 'Dedicated full-viewport concentric pitch clock',
  root: {
    id: 'root-orbital-focus',
    type: 'container',
    direction: 'column',
    children: [
      {
        id: 'cell-clock-fullscreen',
        type: 'cell',
        module: 'orbital',
        flex: 1,
        title: 'Orbital Pitch Clock',
      },
    ],
  },
};

export const PRESET_LAYOUTS: Record<LayoutMode, LayoutDefinition> = {
  'balanced': PRESET_BALANCED,
  'monument': PRESET_MONUMENT,
  'river': PRESET_RIVER,
  'waterfall': PRESET_WATERFALL,
  'dual-stream': PRESET_DUAL_STREAM,
  'orbital-focus': PRESET_ORBITAL_FOCUS,
};

/**
 * Traverses layout tree and returns an array of all leaf cell nodes.
 */
export function getAllCellNodes(node: LayoutNode): LayoutCellNode[] {
  if (node.type === 'cell') {
    return [node];
  }
  const cells: LayoutCellNode[] = [];
  for (const child of node.children) {
    cells.push(...getAllCellNodes(child));
  }
  return cells;
}

/**
 * Finds a cell node by ID in the tree.
 */
export function findCellNodeById(root: LayoutContainerNode, id: string): LayoutCellNode | null {
  if (root.id === id) return null;
  for (const child of root.children) {
    if (child.type === 'cell') {
      if (child.id === id) return child;
    } else {
      const found = findCellNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Clones and modifies a cell node in the tree immutably.
 */
export function updateCellInTree(
  root: LayoutContainerNode,
  cellId: string,
  updater: (cell: LayoutCellNode) => LayoutCellNode
): LayoutContainerNode {
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.type === 'cell') {
        return child.id === cellId ? updater(child) : child;
      }
      return updateCellInTree(child, cellId, updater);
    }),
  };
}

/**
 * Encodes a layout definition into a compact, URL-safe base64 slug for deep linking.
 * If includeAesthetics is false, aesthetic styling properties are omitted.
 */
export function encodeLayoutToSlug(
  layout: LayoutDefinition,
  includeAesthetics: boolean = false
): string {
  try {
    const payload: {
      id: string;
      name: string;
      root: LayoutContainerNode;
      aesthetics?: Partial<AestheticsConfig>;
    } = {
      id: layout.id,
      name: layout.name,
      root: layout.root,
    };

    if (includeAesthetics && layout.aesthetics) {
      payload.aesthetics = layout.aesthetics;
    }

    const json = JSON.stringify(payload);
    // Base64 encode with URL safety (RFC 4648 §5)
    const base64 = typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf-8').toString('base64');

    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.warn('[Layout] Failed to encode layout slug:', err);
    return '';
  }
}

/**
 * Decodes a URL-safe base64 slug into a LayoutDefinition.
 * Returns null if the slug is invalid or malformed.
 */
export function decodeLayoutFromSlug(
  slug: string
): { layout: LayoutDefinition; hasAesthetics: boolean } | null {
  if (!slug || typeof slug !== 'string') return null;

  try {
    // Restore base64 standard characters and padding
    let base64 = slug.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, 'base64').toString('utf-8');

    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.root) {
      return null;
    }

    const hasAesthetics = !!(parsed.aesthetics && typeof parsed.aesthetics === 'object');
    const layout: LayoutDefinition = {
      id: typeof parsed.id === 'string' ? parsed.id : 'custom-link',
      name: typeof parsed.name === 'string' ? parsed.name : 'Imported Layout',
      description: parsed.description,
      root: parsed.root,
      aesthetics: hasAesthetics ? parsed.aesthetics : undefined,
    };

    return { layout, hasAesthetics };
  } catch (err) {
    console.warn('[Layout] Failed to decode layout slug:', err);
    return null;
  }
}
