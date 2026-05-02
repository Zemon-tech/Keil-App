import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { nanoid } from 'nanoid';

declare global {
  namespace TiptapExtension {
    interface Commands<ReturnType> {
      blockId: {
        setBlockId: (id: string) => ReturnType;
      };
    }
  }
}

export const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'blockquote',
          'codeBlock',
          'table',
          'image',
          'horizontalRule',
        ],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
              if (!attributes.id) {
                return {};
              }
              return {
                'data-id': attributes.id,
              };
            },
          },
        },
      },
    ];
  },

  // When a new node is created or we parse it, we want to ensure it has an ID
  // A cleaner approach to node IDs is using appendTransaction in a ProseMirror plugin.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockIdPlugin'),
        appendTransaction: (transactions, oldState, newState) => {
          let tr = newState.tr;
          let modified = false;

          if (!transactions.some(t => t.docChanged)) {
            return null;
          }

          newState.doc.descendants((node, pos) => {
            const typesWithId = [
              'paragraph', 'heading', 'bulletList', 'orderedList', 
              'blockquote', 'codeBlock', 'table', 'image', 'horizontalRule'
            ];
            
            if (typesWithId.includes(node.type.name)) {
              if (!node.attrs.id) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: nanoid() });
                modified = true;
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },

  addCommands() {
    return {
      setBlockId:
        (id: string) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { id });
        },
    };
  },
});
