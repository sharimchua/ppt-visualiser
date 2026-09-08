import React from 'react';
import {
  LayoutNode,
  LayoutCellNode,
  VisualiserConfig,
  LayoutFlexDirection,
  VisualiserModuleType,
} from '../core/types';
import { RenderCoordinator } from '../core/render-coordinator';
import { CellViewport } from './CellViewport';

interface FlexLayoutRendererProps {
  node: LayoutNode;
  config: VisualiserConfig;
  coordinator?: RenderCoordinator;
  onUpdateCell?: (updated: LayoutCellNode) => void;
  isEditMode?: boolean;
  canDelete?: boolean;
  onSplitCell?: (targetCellId: string, direction: LayoutFlexDirection, newModule: VisualiserModuleType) => void;
  onRemoveCell?: (targetCellId: string) => void;
  onDuplicateCell?: (targetCellId: string) => void;
}

export const FlexLayoutRenderer: React.FC<FlexLayoutRendererProps> = ({
  node,
  config,
  coordinator,
  onUpdateCell,
  isEditMode = false,
  canDelete = false,
  onSplitCell,
  onRemoveCell,
  onDuplicateCell,
}) => {
  if (node.type === 'cell') {
    const minH = node.minSize ? Math.max(node.minSize, 96) : 96;
    return (
      <div
        className="layout-flex-node relative min-w-0 min-h-0"
        style={{
          ['--node-flex' as any]: node.flex ?? 1,
          minWidth: node.minSize ? `${node.minSize}px` : undefined,
          minHeight: `${minH}px`,
        }}
      >
        <CellViewport
          cell={node}
          config={config}
          coordinator={coordinator}
          onUpdateCell={onUpdateCell}
          isEditMode={isEditMode}
          canDelete={canDelete}
          onSplitCell={onSplitCell}
          onRemoveCell={onRemoveCell}
          onDuplicateCell={onDuplicateCell}
        />
      </div>
    );
  }

  // Container node: On mobile screens (< 640px portrait), row containers stack vertically as columns
  // so cells are not compressed into unreadable side-by-side slivers.
  const isRow = node.direction === 'row';
  return (
    <div
      className={`layout-flex-node relative w-full h-full flex min-w-0 min-h-0 ${
        isRow ? 'flex-col sm:flex-row' : 'flex-col'
      }`}
      style={{
        ['--node-flex' as any]: node.flex ?? 1,
        gap: `${node.gap ?? 8}px`,
      }}
    >
      {node.children.map((child) => (
        <FlexLayoutRenderer
          key={child.id}
          node={child}
          config={config}
          coordinator={coordinator}
          onUpdateCell={onUpdateCell}
          isEditMode={isEditMode}
          canDelete={canDelete}
          onSplitCell={onSplitCell}
          onRemoveCell={onRemoveCell}
          onDuplicateCell={onDuplicateCell}
        />
      ))}
    </div>
  );
};

