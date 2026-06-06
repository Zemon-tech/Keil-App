import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const BlockSelectionExtension = Extension.create({
  name: 'blockSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockSelection'),
        props: {
          decorations(state) {
            const { selection, doc } = state
            const decorations: Decoration[] = []

            if (selection.empty) {
              return DecorationSet.empty
            }

            let isMultiBlock = false
            let blockCount = 0

            // Determine if the selection spans multiple blocks
            doc.nodesBetween(selection.from, selection.to, (node) => {
              if (node.isBlock && node.type.name !== 'doc') {
                blockCount++
              }
            })

            isMultiBlock = blockCount > 1 || selection instanceof NodeSelection

            if (isMultiBlock) {
              doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                if (node.isBlock && node.type.name !== 'doc') {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'ProseMirror-selectednode',
                    })
                  )
                }
              })
            }

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
