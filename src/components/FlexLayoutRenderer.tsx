import React from 'react';
import {
  LayoutNode,
  LayoutCellNode,
  VisualiserConfig,
  ActiveNote,
  StreamItem,
} from '../core/types';
import { PitchClockRenderer } from '../renderers/pitch-clock-canvas';
import { StreamRenderer } from '../renderers/stream-canvas';
import { CellViewport } from './CellViewport';

interface FlexLayoutRendererProps {
  node: LayoutNode;
  config: VisualiserConfig;
  activeNotes: Map<number, ActiveNote>;
  decayingNotes: Map<number, { note: ActiveNote; decayProgress: number }>;
  streamItems: StreamItem[];
  pitchClockRenderer: PitchClockRenderer;
  streamRenderer: StreamRenderer;
  onUpdateCell?: (updated: LayoutCellNode) => void;
}

export const FlexLayoutRenderer: React.FC<FlexLayoutRendererProps> = ({
  node,
  config,
  activeNotes,
  decayingNotes,
  streamItems,
  pitchClockRenderer,
  streamRenderer,
  onUpdateCell,
}) => {
  if (node.type === 'cell') {
    return (
      <div
        className="relative flex-1 min-w-0 min-h-0"
        style={{
          flexGrow: node.flex ?? 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: node.minSize ? `${node.minSize}px` : undefined,
          minHeight: node.minSize ? `${node.minSize}px` : undefined,
        }}
      >
        <CellViewport
          cell={node}
          config={config}
          activeNotes={activeNotes}
          decayingNotes={decayingNotes}
          streamItems={streamItems}
          pitchClockRenderer={pitchClockRenderer}
          streamRenderer={streamRenderer}
          onUpdateCell={onUpdateCell}
        />
      </div>
    );
  }

  // Container node
  const isRow = node.direction === 'row';
  return (
    <div
      className={`relative w-full h-full flex min-w-0 min-h-0 ${
        isRow ? 'flex-row' : 'flex-col'
      }`}
      style={{
        flexGrow: node.flex ?? 1,
        flexShrink: 1,
        flexBasis: 0,
        gap: `${node.gap ?? 8}px`,
      }}
    >
      {node.children.map((child) => (
        <FlexLayoutRenderer
          key={child.id}
          node={child}
          config={config}
          activeNotes={activeNotes}
          decayingNotes={decayingNotes}
          streamItems={streamItems}
          pitchClockRenderer={pitchClockRenderer}
          streamRenderer={streamRenderer}
          onUpdateCell={onUpdateCell}
        />
      ))}
    </div>
  );
};
