import { type FC } from 'react';
import { useBlockStore } from '../../store/useBlockStore';
import type { Block } from '../../types/block';
import { Copy, Trash2, Palette } from 'lucide-react';

interface BlockToolbarProps {
  blockId: string;
  pageId: string;
}

const BlockToolbar: FC<BlockToolbarProps> = ({ blockId, pageId }) => {
  const blocks = useBlockStore(state => state.blocks);
  const updateBlock = useBlockStore(state => state.updateBlock);
  const deleteBlock = useBlockStore(state => state.deleteBlock);
  
  const block = blocks.get(blockId);

  if (!block) return null;

  const handleDelete = () => {
    useBlockStore.getState().removeBlockFromPage(pageId, blockId);
    deleteBlock(blockId);
  };

  const handleDuplicate = () => {
    const newBlock: Block = {
      ...block,
      id: `block-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    useBlockStore.setState(state => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(newBlock.id, newBlock);
      return { blocks: newBlocks };
    });
    useBlockStore.getState().addBlockToPage(pageId, newBlock.id, blockId);
  };

  const handleColorChange = (color: string) => {
    updateBlock(blockId, { 
      properties: { ...block.properties, color, backgroundColor: color } 
    });
  };

  return (
    <div className="absolute top-0 right-0 hidden group-hover:flex gap-1 bg-white dark:bg-gray-800 rounded-md shadow-md p-1 border border-gray-200 dark:border-gray-700 z-10">
      <button
        onClick={handleDuplicate}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors"
        title="Duplicate"
      >
        <Copy size={14} />
      </button>
      <button
        onClick={() => handleColorChange('bg-yellow-100 dark:bg-yellow-900/30')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors"
        title="Highlight"
      >
        <Palette size={14} />
      </button>
      <button
        onClick={handleDelete}
        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500 hover:text-red-600 transition-colors"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

export default BlockToolbar;
