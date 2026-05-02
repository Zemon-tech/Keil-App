import { type FC, useEffect, useState } from 'react';
import { useBlockStore } from '../../store/useBlockStore';
import type { BlockType } from '../../types/block';
import { Type, Heading1, Heading2, Heading3, Image as ImageIcon, Code, List, ListOrdered, CheckSquare, Quote, Minus, Table, FileText, FileDown } from 'lucide-react';

interface BlockMenuProps {
  blockId: string;
  onClose: () => void;
  position: { top: number; left: number };
}

const MENU_ITEMS: { type: BlockType; label: string; desc: string; icon: any }[] = [
  { type: 'text', label: 'Text', desc: 'Just start writing with plain text', icon: Type },
  { type: 'subpage', label: 'Subpage', desc: 'Create a nested page', icon: FileText },
  { type: 'h1', label: 'Heading 1', desc: 'Big section heading', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', desc: 'Medium section heading', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', desc: 'Small section heading', icon: Heading3 },
  { type: 'bullet-list', label: 'Bullet list', desc: 'Create a bulleted list', icon: List },
  { type: 'numbered-list', label: 'Numbered list', desc: 'Create a numbered list', icon: ListOrdered },
  { type: 'todo-list', label: 'To-do list', desc: 'Track tasks with checkboxes', icon: CheckSquare },
  { type: 'quote', label: 'Quote', desc: 'Capture a quote', icon: Quote },
  { type: 'code', label: 'Code block', desc: 'Write code with monospaced font', icon: Code },
  { type: 'divider', label: 'Divider', desc: 'Insert a horizontal rule', icon: Minus },
  { type: 'table', label: 'Table', desc: 'Insert a table', icon: Table },
  { type: 'image', label: 'Image', desc: 'Embed an image', icon: ImageIcon },
  { type: 'pdf', label: 'PDF', desc: 'Embed a PDF', icon: FileDown },
];

const BlockMenu: FC<BlockMenuProps> = ({ blockId, onClose, position }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % MENU_ITEMS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(MENU_ITEMS[selectedIndex].type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedIndex, onClose]);

  const selectItem = (type: BlockType) => {
    // Clear the slash
    updateBlock(blockId, { type, content: '' });
    onClose();
    
    // For non-text blocks, we blur to stop typing. Text blocks can keep focus.
    if (type !== 'text' && type !== 'h1' && type !== 'h2' && type !== 'h3') {
      const el = document.activeElement as HTMLElement;
      if (el) el.blur();
    }
  };

  return (
    <div 
      className="fixed z-50 w-72 bg-white dark:bg-[#252525] rounded-md shadow-xl border border-gray-200 dark:border-gray-800 py-2 max-h-80 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Basic blocks
      </div>
      {MENU_ITEMS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={item.type}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              idx === selectedIndex 
                ? 'bg-gray-100 dark:bg-gray-700' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => selectItem(item.type)}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300">
              <Icon size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default BlockMenu;
