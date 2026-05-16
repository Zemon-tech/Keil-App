import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { FileText, Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMotionStore } from '@/store/useMotionStore'

export const SubpageExtension = Node.create({
  name: 'subpage',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      title: {
        default: 'Untitled',
      },
      icon: {
        default: null,
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="subpage"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'subpage' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      const navigate = useNavigate()
      const { id, title: attrTitle, icon: attrIcon } = node.attrs

      // Get reactive page data from store if it exists
      const pages = useMotionStore(state => state.pages)
      const page = pages.find(p => p.id === id)
      
      const title = page?.title || attrTitle
      const icon = page?.icon || attrIcon

      return (
        <NodeViewWrapper className="subpage-block my-0.5">
          <div 
            className="flex items-center gap-3 py-1 px-1.5 rounded hover:bg-muted/30 cursor-pointer group/subpage transition-all w-full select-none"
            onClick={() => navigate(`/motion/${id}`)}
          >
            <div className="shrink-0 flex items-center justify-center text-muted-foreground/60 group-hover/subpage:text-foreground/80 transition-colors">
              {icon ? (
                 icon.startsWith('lucide:') ? (
                   (() => {
                     const iconName = icon.split(':')[1]
                     const icons: Record<string, any> = { Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee, Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail, Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle, AlertCircle, XCircle, Clock, Zap }
                     const Icon = icons[iconName] || FileText
                     return <Icon className="size-[18px] stroke-[1.5]" />
                   })()
                 ) : (
                   <span className="text-lg leading-none">{icon}</span>
                 )
              ) : (
                 <FileText className="size-[18px] stroke-[1.5]" />
              )}
            </div>
            <span className="text-[14.5px] font-medium text-foreground/80 group-hover/subpage:text-foreground group-hover/subpage:underline decoration-foreground/40 underline-offset-[3px] decoration-1 transition-all truncate">
              {title}
            </span>
          </div>
        </NodeViewWrapper>
      )
    })
  }
})
