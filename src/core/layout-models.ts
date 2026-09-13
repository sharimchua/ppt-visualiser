import {
  LayoutDefinition,
  LayoutNode,
  LayoutCellNode,
  LayoutContainerNode,
  LayoutMode,
  AestheticsConfig,
  LayoutFlexDirection,
  VisualiserModuleType,
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
  description: 'Maximised Pitch Clock display with compact baseline stream',
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
  description: 'Centre Pitch Clock flanked by Bass Stream and Treble Stream',
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

export const PRESET_SIGNATURE: LayoutDefinition = {
  id: 'signature',
  name: 'Scale Signature Trio',
  description: 'Concentric Pitch Clock on top with side-by-side Piano Triangles and Overtone Waves below',
  root: {
    id: 'root-signature',
    type: 'container',
    direction: 'column',
    gap: 8,
    children: [
      {
        id: 'cell-clock-sig',
        type: 'cell',
        module: 'orbital',
        flex: 3,
        title: 'Orbital Pitch Clock',
      },
      {
        id: 'container-sig-bottom',
        type: 'container',
        direction: 'row',
        flex: 1.5,
        gap: 8,
        children: [
          {
            id: 'cell-triangles-sig',
            type: 'cell',
            module: 'triangles',
            flex: 1,
            minSize: 90,
            title: 'Piano Triangles',
          },
          {
            id: 'cell-overtones-sig',
            type: 'cell',
            module: 'overtones',
            flex: 1,
            minSize: 90,
            title: 'Overtone Waves',
            configOverrides: {
              showDissonanceCurve: true,
              showOvertoneLabels: true,
              fluidSpeed: 1.0,
            },
          },
        ],
      },
    ],
  },
  aesthetics: {
    backgroundTheme: 'carbon-grid',
    filmGrainIntensity: 0.35,
    filmGrainSize: 3,
    filmGrainContrast: 0.45,
    particleIntensity: 0.9,
    glowBloom: 0.8,
    motionTrails: 0.6,
    ghostingIntensity: 0.3,
    lightBleedIntensity: 0.45,
    scanlineIntensity: 0.4,
    scanlineDensity: 2,
    crtVignette: 0.3,
    lensFlareIntensity: 0.55,
    lensFlareStyle: 'cinematic',
  },
};

export const PRESET_HARMONIC: LayoutDefinition = {
  id: 'harmonic',
  name: 'Harmonic Waves',
  description: 'Concentric Pitch Clock paired with kinetic Overtone fluid wave simulation',
  root: {
    id: 'root-harmonic',
    type: 'container',
    direction: 'column',
    gap: 8,
    children: [
      {
        id: 'cell-clock-harmonic',
        type: 'cell',
        module: 'orbital',
        flex: 2,
        title: 'Pitch Clock',
      },
      {
        id: 'container-harmonic-bottom',
        type: 'container',
        direction: 'row',
        flex: 2,
        gap: 8,
        children: [
          {
            id: 'cell-overtones-harmonic',
            type: 'cell',
            module: 'overtones',
            flex: 2,
            title: 'Overtone Waves',
            configOverrides: {
              showDissonanceCurve: true,
              showOvertoneLabels: true,
              fluidSpeed: 1.0,
            },
          },
          {
            id: 'cell-stream-harmonic',
            type: 'cell',
            module: 'stream',
            flex: 1,
            title: 'Note Stream',
            configOverrides: {
              orientation: 'horizontal',
              direction: 'rtl',
              streamMode: 'continuous',
            },
          },
        ],
      },
    ],
  },
  aesthetics: {
    backgroundTheme: 'carbon-grid',
    filmGrainIntensity: 0.35,
    filmGrainSize: 3,
    filmGrainContrast: 0.45,
    particleIntensity: 0.9,
    glowBloom: 0.8,
    motionTrails: 0.6,
    ghostingIntensity: 0.3,
    lightBleedIntensity: 0.45,
    scanlineIntensity: 0.4,
    scanlineDensity: 2,
    crtVignette: 0.3,
    lensFlareIntensity: 0.55,
    lensFlareStyle: 'cinematic',
  },
};

export const PRESET_RHYTHM_DEBUG: LayoutDefinition = {
  id: 'rhythm-debug',
  name: 'Rhythm Studio & Debug',
  description: 'Rhythm Orbit polar cycle visualiser with real-time stream segregation & prime-family probability telemetry',
  root: {
    id: 'root-rhythm-debug',
    type: 'container',
    direction: 'row',
    gap: 8,
    children: [
      {
        id: 'cell-rhythm-orbit-main',
        type: 'cell',
        module: 'rhythm-orbit',
        flex: 1.2,
        title: 'Rhythm Orbit',
      },
      {
        id: 'cell-rhythm-debug-telemetry',
        type: 'cell',
        module: 'rhythm-debug',
        flex: 1.8,
        minSize: 220,
        title: 'Rhythm Engine Telemetry',
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
  'signature': PRESET_SIGNATURE,
  'harmonic': PRESET_HARMONIC,
  'rhythm-debug': PRESET_RHYTHM_DEBUG,
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
 * Creates a unique identifier for a newly added cell node.
 */
export function createUniqueCellId(module: VisualiserModuleType = 'stream'): string {
  const rand = Math.random().toString(36).slice(2, 7);
  const timestamp = Date.now().toString(36);
  return `cell-${module}-${timestamp}-${rand}`;
}

/**
 * Creates a unique identifier for a container node.
 */
export function createUniqueContainerId(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  const timestamp = Date.now().toString(36);
  return `container-${timestamp}-${rand}`;
}

/**
 * Splits a target cell in the layout tree along row or column direction.
 * If the parent container has the requested direction, a new sibling cell is inserted.
 * Otherwise, the cell is replaced by a nested container holding both cells.
 */
export function splitCellInTree(
  root: LayoutContainerNode,
  targetCellId: string,
  direction: LayoutFlexDirection,
  newModule: VisualiserModuleType = 'stream'
): LayoutContainerNode {
  const newCellId = createUniqueCellId(newModule);

  function splitNode(container: LayoutContainerNode): LayoutContainerNode {
    const directChildIdx = container.children.findIndex(
      (c) => c.type === 'cell' && c.id === targetCellId
    );

    if (directChildIdx !== -1) {
      const targetCell = container.children[directChildIdx] as LayoutCellNode;
      const newCell: LayoutCellNode = {
        id: newCellId,
        type: 'cell',
        module: newModule,
        flex: 1,
        title:
          newModule === 'orbital'
            ? 'Pitch Clock'
            : newModule === 'triangles'
            ? 'Piano Triangles'
            : newModule === 'overtones'
            ? 'Overtone Waves'
            : newModule === 'staff-stream'
            ? 'Staff Stream'
            : newModule === 'rhythm-orbit'
            ? 'Rhythm Orbit'
            : 'Note Stream',
        configOverrides:
          newModule === 'stream'
            ? {
                orientation: direction === 'row' ? 'vertical' : 'horizontal',
                direction: direction === 'row' ? 'ttb' : 'rtl',
              }
            : undefined,
      };

      if (container.direction === direction) {
        // Parent container already flows in this direction: insert next to target
        const newChildren = [...container.children];
        newChildren.splice(directChildIdx + 1, 0, newCell);
        return {
          ...container,
          children: newChildren,
        };
      } else {
        // Parent container flows in perpendicular direction: replace target with a sub-container
        const subContainer: LayoutContainerNode = {
          id: createUniqueContainerId(),
          type: 'container',
          direction: direction,
          flex: targetCell.flex ?? 1,
          gap: container.gap ?? 8,
          children: [
            { ...targetCell, flex: 1 },
            newCell,
          ],
        };
        const newChildren = [...container.children];
        newChildren[directChildIdx] = subContainer;
        return {
          ...container,
          children: newChildren,
        };
      }
    }

    // Recurse into child containers
    return {
      ...container,
      children: container.children.map((child) =>
        child.type === 'container' ? splitNode(child) : child
      ),
    };
  }

  return splitNode(root);
}

/**
 * Removes a cell from the layout tree.
 * Automatically prunes empty or single-child container nodes to keep the tree normalised.
 * Enforces a minimum of 1 cell in the layout.
 */
export function removeCellFromTree(
  root: LayoutContainerNode,
  targetCellId: string
): LayoutContainerNode {
  const allCells = getAllCellNodes(root);
  if (allCells.length <= 1) {
    // Cannot delete the only remaining cell in the layout
    return root;
  }

  function prune(container: LayoutContainerNode): LayoutContainerNode {
    const updatedChildren: LayoutNode[] = [];

    for (const child of container.children) {
      if (child.type === 'cell') {
        if (child.id !== targetCellId) {
          updatedChildren.push(child);
        }
      } else {
        const prunedSub = prune(child);
        if (prunedSub.children.length > 0) {
          // Flatten redundant single-child container
          if (prunedSub.children.length === 1) {
            const single = prunedSub.children[0];
            updatedChildren.push(single);
          } else {
            updatedChildren.push(prunedSub);
          }
        }
      }
    }

    return {
      ...container,
      children: updatedChildren,
    };
  }

  const prunedRoot = prune(root);
  // Ensure root never has 0 children
  if (prunedRoot.children.length === 0) {
    return root;
  }
  return prunedRoot;
}

/**
 * Duplicates an existing cell with its configuration overrides and inserts it alongside.
 */
export function duplicateCellInTree(
  root: LayoutContainerNode,
  targetCellId: string
): LayoutContainerNode {
  const target = findCellNodeById(root, targetCellId);
  if (!target) return root;

  const cloneId = createUniqueCellId(target.module);
  const clone: LayoutCellNode = {
    ...target,
    id: cloneId,
    title: target.title ? `${target.title} (Copy)` : undefined,
    configOverrides: target.configOverrides ? { ...target.configOverrides } : undefined,
  };

  function insertClone(container: LayoutContainerNode): LayoutContainerNode {
    const idx = container.children.findIndex(
      (c) => c.type === 'cell' && c.id === targetCellId
    );
    if (idx !== -1) {
      const newChildren = [...container.children];
      newChildren.splice(idx + 1, 0, clone);
      return {
        ...container,
        children: newChildren,
      };
    }
    return {
      ...container,
      children: container.children.map((c) =>
        c.type === 'container' ? insertClone(c) : c
      ),
    };
  }

  return insertClone(root);
}

/**
 * Moves a cell forward or backward in its parent container's child order.
 */
export function moveCellInTree(
  root: LayoutContainerNode,
  cellId: string,
  delta: -1 | 1
): LayoutContainerNode {
  function reorder(container: LayoutContainerNode): LayoutContainerNode {
    const idx = container.children.findIndex((c) => c.id === cellId);
    if (idx !== -1) {
      const newIdx = idx + delta;
      if (newIdx >= 0 && newIdx < container.children.length) {
        const newChildren = [...container.children];
        const temp = newChildren[idx];
        newChildren[idx] = newChildren[newIdx];
        newChildren[newIdx] = temp;
        return {
          ...container,
          children: newChildren,
        };
      }
      return container;
    }
    return {
      ...container,
      children: container.children.map((c) =>
        c.type === 'container' ? reorder(c) : c
      ),
    };
  }

  return reorder(root);
}

/**
 * Appends a new cell to the layout tree root.
 */
export function addCellToTree(
  root: LayoutContainerNode,
  direction: LayoutFlexDirection = 'row',
  module: VisualiserModuleType = 'stream'
): LayoutContainerNode {
  const newCell: LayoutCellNode = {
    id: createUniqueCellId(module),
    type: 'cell',
    module,
    flex: 1,
    title:
      module === 'orbital'
        ? 'Pitch Clock'
        : module === 'triangles'
        ? 'Piano Triangles'
        : module === 'overtones'
        ? 'Overtone Waves'
        : module === 'staff-stream'
        ? 'Staff Stream'
        : module === 'rhythm-orbit'
        ? 'Rhythm Orbit'
        : 'Note Stream',
    configOverrides:
      module === 'stream'
        ? {
            orientation: direction === 'row' ? 'vertical' : 'horizontal',
            direction: direction === 'row' ? 'ttb' : 'rtl',
          }
        : undefined,
  };

  if (root.direction === direction) {
    return {
      ...root,
      children: [...root.children, newCell],
    };
  }

  if (root.children.length <= 1) {
    return {
      ...root,
      direction,
      children: [...root.children, newCell],
    };
  }

  // Wrap existing root into a container
  return {
    id: createUniqueContainerId(),
    type: 'container',
    direction,
    flex: 1,
    gap: root.gap ?? 8,
    children: [
      root,
      newCell,
    ],
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
