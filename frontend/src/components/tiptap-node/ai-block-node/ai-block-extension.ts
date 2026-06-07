import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { AiBlockComponent } from "./ai-block"

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    aiBlock: {
      setAiBlock: (options?: any) => ReturnType
    }
  }
}

export const AiBlock = Node.create({
  name: "aiBlock",

  group: "block",

  draggable: true,

  selectable: true,

  atom: true,

  addAttributes() {
    return {
      prompt: {
        default: "",
      },
      action: {
        default: "custom", // custom, summary, todo, outline, brainstorm
      },
      context: {
        default: "page",
      },
      generatedText: {
        default: "",
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ai-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "ai-block" }, HTMLAttributes),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiBlockComponent)
  },

  addCommands() {
    return {
      setAiBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

export default AiBlock
