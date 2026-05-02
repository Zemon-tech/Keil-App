import React, { type FC } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import TextBlock from './TextBlock';
import ImageBlock from './ImageBlock';
import CodeBlock from './CodeBlock';
import ListBlock from './ListBlock';
import { useBlockStore } from '../../store/useBlockStore';
import BlockToolbar from '../BlockEditor/BlockToolbar';
import { GripVertical } from 'lucide-react';

interface BlockProps {
  blockId: string;
  pageId: string;
}

const Block: FC<BlockProps> = ({ blockId, pageId }) => {
  const blocks = useBlockStore(state => state.blocks);
  const selectedBlockId = useBlockStore(state => state.selectedBlockId);
  const setSelectedBlock = useBlockStore(state => state.setSelectedBlock);
  
  const block = blocks.get(blockId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  if (!block) return null;

  const isSelected = selectedBlockId === blockId;

  const handleBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlock(blockId);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group mb-1 ${
        isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20 rounded-md' : ''
      }`}
      onClick={handleBlockClick}
      data-block-id={blockId}
    >
      {/* Block Drag Handle - Spans gap to prevent hover loss */}
      <div 
        className="absolute -left-12 top-0 w-12 h-full flex items-start justify-end pr-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <div 
          className="flex items-center justify-center h-6 w-6 cursor-grab hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </div>
      </div>

      <div className="py-1 px-2">
        {block.type === 'text' && <TextBlock key="text" block={block} pageId={pageId} />}
        {block.type === 'h1' && <TextBlock key="h1" block={block} variant="h1" pageId={pageId} />}
        {block.type === 'h2' && <TextBlock key="h2" block={block} variant="h2" pageId={pageId} />}
        {block.type === 'h3' && <TextBlock key="h3" block={block} variant="h3" pageId={pageId} />}
        {block.type === 'quote' && <TextBlock key="quote" block={block} variant="quote" pageId={pageId} />}
        
        {block.type === 'bullet-list' && <ListBlock key="bullet" block={block} pageId={pageId} variant="bullet" />}
        {block.type === 'numbered-list' && <ListBlock key="numbered" block={block} pageId={pageId} variant="number" />}
        {block.type === 'todo-list' && <ListBlock key="todo" block={block} pageId={pageId} variant="todo" />}
        
        {block.type === 'image' && <ImageBlock key="image" block={block} />}
        {block.type === 'pdf' && <ImageBlock key="pdf" block={block} isPdf />}
        {block.type === 'code' && <CodeBlock key="code" block={block} />}
        {block.type === 'divider' && <hr className="my-4 border-gray-200 dark:border-gray-800" />}
        {/* TODO: Implement Table and Subpage fully, fallback to text for now if not implemented */}
        {block.type === 'table' && <div className="p-4 bg-gray-50 border rounded text-gray-500 text-sm">Table Block (Coming Soon)</div>}
        {block.type === 'subpage' && <div className="p-2 border rounded flex items-center gap-2 cursor-pointer hover:bg-gray-50"><span className="text-xl">📄</span> Untitled Subpage</div>}
      </div>

      {/* Block Toolbar (appears on hover) */}
      {isSelected && <BlockToolbar blockId={blockId} pageId={pageId} />}
    </div>
  );
};

export default Block;
