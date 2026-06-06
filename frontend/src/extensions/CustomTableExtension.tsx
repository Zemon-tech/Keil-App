import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {}
          return { 
            style: `background-color: ${attributes.backgroundColor}`,
            'data-background-color': attributes.backgroundColor 
          }
        }
      }
    }
  }
})

export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {}
          return { 
            style: `background-color: ${attributes.backgroundColor}`,
            'data-background-color': attributes.backgroundColor 
          }
        }
      }
    }
  }
})

// Keep CustomTable to allow seamless class extending if needed, but render natively
export const CustomTable = Table.extend({
  // Render standard HTML natively (allows columns to keep their correct widths)
})
