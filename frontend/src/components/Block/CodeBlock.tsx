import React, { type FC } from 'react';
import type { Block } from '../../types/block';
import { useBlockStore } from '../../store/useBlockStore';

interface CodeBlockProps {
  block: Block;
}

const CodeBlock: FC<CodeBlockProps> = ({ block }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const setFocusedBlock = useBlockStore(state => state.setFocusedBlock);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateBlock(block.id, { content: { ...block.content, code: e.target.value } });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(block.id, { content: { ...block.content, language: e.target.value } });
  };

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <select 
          className="text-xs bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none"
          value={block.content?.language || 'javascript'}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="python">Python</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <textarea
        className="w-full min-h-[100px] p-4 bg-transparent font-mono text-sm outline-none resize-y text-gray-800 dark:text-gray-200"
        value={block.content?.code || ''}
        onChange={handleChange}
        onFocus={() => setFocusedBlock(block.id)}
        onBlur={() => setFocusedBlock(null)}
        placeholder="Write code here..."
        spellCheck={false}
      />
    </div>
  );
};

export default CodeBlock;
