import React, { type FC, useRef, useState, useCallback, useEffect } from 'react';
import type { Block } from '../../types/block';
import { useBlockStore } from '../../store/useBlockStore';
import BlockMenu from '../BlockEditor/BlockMenu';

interface TextBlockProps {
  block: Block;
  variant?: 'text' | 'h1' | 'h2' | 'h3' | 'quote';
  pageId: string;
}

const TextBlock: FC<TextBlockProps> = ({ block, variant = 'text', pageId }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const setFocusedBlock = useBlockStore(state => state.setFocusedBlock);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const divRef = useRef<HTMLDivElement>(null);

  // Set content ONCE on mount — never again while focused
  useEffect(() => {
    if (divRef.current) {
      divRef.current.textContent = block.content ?? '';
    }
    // intentionally only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only sync from store when content is cleared externally (e.g. after slash menu)
  // and the element is NOT focused (user isn't actively typing)
  const blockContent = block.content ?? '';
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (document.activeElement === el) return; // never interrupt typing
    if (el.textContent !== blockContent) {
      el.textContent = blockContent;
    }
  }, [blockContent]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const content = e.currentTarget.textContent ?? '';
    updateBlock(block.id, { content });

    // Slash command detection
    if (content === '/') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
        setMenuOpen(true);
      }
    } else {
      setMenuOpen(false);
    }
  }, [block.id, updateBlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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
      useBlockStore.getState().addBlockToPage(pageId, newBlockId, block.id);

      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${newBlockId}"] [contenteditable]`) as HTMLElement;
        if (el) el.focus();
        setFocusedBlock(newBlockId);
      }, 0);

    } else if (e.key === 'Backspace' && (divRef.current?.textContent ?? '') === '') {
      e.preventDefault();

      let prevBlockId: string | null = null;
      const page = useBlockStore.getState().pages[pageId];
      if (page) {
        const idx = page.blocks.indexOf(block.id);
        if (idx > 0) prevBlockId = page.blocks[idx - 1];
      }

      useBlockStore.getState().removeBlockFromPage(pageId, block.id);
      useBlockStore.setState(state => {
        const newBlocks = new Map(state.blocks);
        newBlocks.delete(block.id);
        return {
          blocks: newBlocks,
          focusedBlockId: prevBlockId,
          selectedBlockId: state.selectedBlockId === block.id ? null : state.selectedBlockId,
        };
      });

      if (prevBlockId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${prevBlockId}"] [contenteditable]`) as HTMLElement;
          if (el) {
            el.focus();
            try {
              const sel = window.getSelection();
              if (sel) {
                const range = document.createRange();
                const target = el.lastChild?.nodeType === 3 ? el.lastChild : el;
                range.selectNodeContents(target);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            } catch (_) { /* ignore */ }
          }
        }, 0);
      }
    }
  }, [block.id, pageId, setFocusedBlock]);

  const variantClass =
    variant === 'h1' ? 'text-4xl font-bold mb-4 mt-6' :
    variant === 'h2' ? 'text-2xl font-bold mb-3 mt-5' :
    variant === 'h3' ? 'text-xl font-bold mb-2 mt-4' :
    variant === 'quote' ? 'text-lg border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 italic my-2' :
    'text-base';

  return (
    <>
      {/* 
        CRITICAL: Do NOT use dangerouslySetInnerHTML or children on contentEditable.
        Both cause React to reset the DOM on every render → cursor jumps to position 0.
        We set initial content via useEffect + ref on mount only.
      */}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        className={`outline-none min-h-[1.5em] w-full ${variantClass} ${block.properties?.backgroundColor || ''}
          [&:empty]:before:content-['Type_"/"_for_commands'] [&:empty]:before:text-gray-400 [&:empty]:before:pointer-events-none`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocusedBlock(block.id)}
        onBlur={() => setFocusedBlock(null)}
      />

      {menuOpen && (
        <BlockMenu
          blockId={block.id}
          position={menuPos}
          onClose={() => {
            setMenuOpen(false);
            // Clear the "/" visually after slash menu closes
            if (divRef.current) {
              divRef.current.textContent = block.content ?? '';
            }
          }}
        />
      )}
    </>
  );
};

export default TextBlock;
