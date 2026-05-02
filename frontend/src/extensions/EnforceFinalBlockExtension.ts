import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { nanoid } from 'nanoid';

export const EnforceFinalBlockExtension = Extension.create({
  name: 'enforceFinalBlock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const { doc } = newState;
          const docSize = doc.content.size;

          // Check if the last node is a paragraph with content
          let needsNewParagraph = false;

          if (docSize === 0) {
            needsNewParagraph = true;
          } else {
            const lastNode = doc.lastChild;
            if (!lastNode || lastNode.type.name !== 'paragraph') {
              needsNewParagraph = true;
            } else if (lastNode.content.size > 0) {
              // Paragraph has content, might need another empty one
              needsNewParagraph = true;
            }
          }

          if (needsNewParagraph) {
            const tr = newState.tr;
            const paragraph = newState.schema.nodes.paragraph.create(
              { id: nanoid() },
              []
            );
            tr.insert(docSize, paragraph);
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});
