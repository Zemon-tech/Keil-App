import { type FC } from 'react';
import type { Block } from '../../types/block';

import TextBlock from './TextBlock';

import { useBlockStore } from '../../store/useBlockStore';

interface ListBlockProps {
  block: Block;
  pageId: string;
  variant: 'bullet' | 'number' | 'todo';
}

const ListBlock: FC<ListBlockProps> = ({ block, pageId, variant }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const checked = block.properties?.checked || false;

  return (
    <div className="flex gap-2 w-full my-1">
      <div className="select-none flex items-center justify-center min-w-[24px] mt-[6px]">
        {variant === 'bullet' && <div className="w-1.5 h-1.5 rounded-full bg-gray-800 dark:bg-gray-200" />}
        {variant === 'number' && <span className="text-gray-500 text-sm font-medium">1.</span>}
        {variant === 'todo' && (
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={checked}
            onChange={(e) => updateBlock(block.id, { properties: { ...block.properties, checked: e.target.checked } })}
          />
        )}
      </div>
      <div className={`flex-1 ${variant === 'todo' && checked ? 'line-through text-gray-400' : ''}`}>
        <TextBlock block={block} pageId={pageId} />
      </div>
    </div>
  );
};

export default ListBlock;
