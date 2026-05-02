import { type FC, useEffect, useState } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useBlockStore } from '../../store/useBlockStore';
import Block from '../Block/Block';

interface EditorProps {
  pageId: string;
}

const BlockEditor: FC<EditorProps> = ({ pageId }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const blockIds = useBlockStore(state => state.pages[pageId]?.blocks);
  const initPage = useBlockStore(state => state.initPage);
  const reorderBlocks = useBlockStore(state => state.reorderBlocks);

  useEffect(() => {
    initPage(pageId);
    setIsInitialized(true);
  }, [pageId, initPage]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // minimum distance to drag before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && blockIds) {
      const oldIndex = blockIds.findIndex(id => id === active.id);
      const newIndex = blockIds.findIndex(id => id === over.id);
      
      const newOrder = arrayMove(blockIds, oldIndex, newIndex);
      reorderBlocks(pageId, newOrder);
    }
  };

  if (!isInitialized || !blockIds) {
    return <div>Loading editor...</div>;
  }



  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only trigger if clicking outside of any block
    if (!target.closest('[data-block-id]')) {
      if (!blockIds || blockIds.length === 0) return;
      
      const lastBlockId = blockIds[blockIds.length - 1];
      const lastBlock = useBlockStore.getState().blocks.get(lastBlockId);
      
      if (lastBlock && lastBlock.content === '' && lastBlock.type === 'text') {
        // Just focus the last block
        const el = document.querySelector(`[data-block-id="${lastBlockId}"] [contenteditable]`) as HTMLElement;
        if (el) {
          el.focus();
          const selection = window.getSelection();
          if (selection) {
            try {
              const range = document.createRange();
              if (el.lastChild) {
                const textNode = el.lastChild.nodeType === 3 ? el.lastChild : el;
                range.selectNodeContents(textNode);
              } else {
                range.selectNodeContents(el);
              }
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (err) {
              console.error('Selection error:', err);
            }
          }
        }
      } else {
        // Create new block
        const newBlockId = `block-${Date.now()}`;
        useBlockStore.setState(state => {
          const newBlocks = new Map(state.blocks);
          newBlocks.set(newBlockId, {
            id: newBlockId,
            type: 'text',
            content: '',
            properties: {},
            metadata: { version: 1 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return { blocks: newBlocks };
        });
        useBlockStore.getState().addBlockToPage(pageId, newBlockId);
        
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${newBlockId}"] [contenteditable]`) as HTMLElement;
          if (el) el.focus();
        }, 0);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-32 min-h-screen cursor-text" onClick={handleEditorClick}>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={blockIds}
          strategy={verticalListSortingStrategy}
        >
          {blockIds.map(id => (
            <Block key={id} blockId={id} pageId={pageId} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default BlockEditor;
