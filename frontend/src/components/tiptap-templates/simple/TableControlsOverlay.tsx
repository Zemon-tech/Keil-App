import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  GripVertical,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Eraser,
  Check
} from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useAppContext } from '@/contexts/AppContext'
import { useSpaceMembers } from '@/hooks/api/useSpaces'
import { useCachedPageById } from '@/hooks/api/useMotionPages'

const TABLE_COLORS = [
  { name: 'Default', bg: 'transparent', labelBg: 'bg-transparent border border-border' },
  { name: 'Gray', bg: 'var(--muted)', labelBg: 'bg-neutral-500/20' },
  { name: 'Brown', bg: 'rgba(100, 71, 58, 0.15)', labelBg: 'bg-[rgba(100,71,58,0.3)]' },
  { name: 'Orange', bg: 'rgba(217, 115, 13, 0.15)', labelBg: 'bg-[rgba(217,115,13,0.3)]' },
  { name: 'Yellow', bg: 'rgba(223, 171, 1, 0.15)', labelBg: 'bg-[rgba(223,171,1,0.3)]' },
  { name: 'Green', bg: 'rgba(15, 123, 108, 0.15)', labelBg: 'bg-[rgba(15,123,108,0.3)]' },
  { name: 'Blue', bg: 'rgba(11, 110, 153, 0.15)', labelBg: 'bg-[rgba(11,110,153,0.3)]' },
  { name: 'Purple', bg: 'rgba(105, 64, 165, 0.15)', labelBg: 'bg-[rgba(105,64,165,0.3)]' },
  { name: 'Pink', bg: 'rgba(173, 26, 114, 0.15)', labelBg: 'bg-[rgba(173,26,114,0.3)]' },
  { name: 'Red', bg: 'rgba(224, 62, 62, 0.15)', labelBg: 'bg-[rgba(224,62,62,0.3)]' },
]

export function TableControlsOverlay({ editor }: { editor: any }) {
  const { pageId } = useParams<{ pageId: string }>()
  const { activeOrgId, activeSpaceId } = useAppContext()
  const { data: members = [] } = useSpaceMembers(activeOrgId, activeSpaceId)
  const page = useCachedPageById(pageId)

  // Last edited metadata
  const lastEditedMeta = useMemo(() => {
    if (!page?.updated_by) return null
    const member = members.find((m) => m.user_id === page.updated_by)
    const name = member?.name || member?.email || 'User'
    const dateStr = page.updated_at 
      ? new Date(page.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return { name, date: dateStr }
  }, [members, page?.updated_by, page?.updated_at])

  // Hover states
  const [activeTableEl, setActiveTableEl] = useState<HTMLTableElement | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)

  // Menu active states
  const [activeMenuTableEl, setActiveMenuTableEl] = useState<HTMLTableElement | null>(null)
  const [activeMenuRowIndex, setActiveMenuRowIndex] = useState<number | null>(null)
  const [activeMenuColIndex, setActiveMenuColIndex] = useState<number | null>(null)

  // Coords states
  const [rowCoords, setRowCoords] = useState<{ top: number; height: number } | null>(null)
  const [colCoords, setColCoords] = useState<{ left: number; width: number } | null>(null)
  const [tableRight, setTableRight] = useState<number | null>(null)

  // Search queries
  const [rowSearch, setRowSearch] = useState('')
  const [colSearch, setColSearch] = useState('')

  // Hover delay timer
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHideTimeout = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      if (activeMenuRowIndex === null && activeMenuColIndex === null) {
        setActiveTableEl(null)
        setHoveredRow(null)
        setHoveredCol(null)
      }
    }, 350)
  }

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // Resolve table pos and node inside ProseMirror
  const getTableInfo = (tableEl: HTMLTableElement) => {
    try {
      const pos = editor.view.posAtDOM(tableEl, 0)
      const $pos = editor.state.doc.resolve(pos)
      for (let d = $pos.depth; d >= 0; d--) {
        const n = $pos.node(d)
        if (n.type.name === 'table') {
          return { pos: $pos.before(d), node: n }
        }
      }
    } catch (err) {
      console.error('Error resolving table node:', err)
    }
    return null
  }

  // Handle pointer tracking
  useEffect(() => {
    const editorDom = editor?.view?.dom
    if (!editorDom) return

    const onPointerMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      const cellEl = target.closest('td, th') as HTMLElement | null

      if (!cellEl) {
        // Clear if not over cell, table, handles, or menus
        const isOverHandles = target.closest('.table-handle-overlay')
        const isOverPopover = target.closest('[data-radix-popper-content-wrapper]')
        if (!isOverHandles && !isOverPopover && activeMenuRowIndex === null && activeMenuColIndex === null) {
          startHideTimeout()
        }
        return
      }

      clearHideTimeout()

      const tableEl = cellEl.closest('table') as HTMLTableElement | null
      const rowEl = cellEl.closest('tr') as HTMLElement | null
      const wrapperEl = tableEl?.closest('.simple-editor-wrapper') as HTMLElement | null

      if (!tableEl || !rowEl || !wrapperEl) return

      setActiveTableEl(tableEl)

      const rows = Array.from(tableEl.querySelectorAll('tr')) as HTMLElement[]
      const rowIndex = rows.indexOf(rowEl)

      const cellsInRow = Array.from(rowEl.children)
      const colIndex = cellsInRow.indexOf(cellEl)

      setHoveredRow(rowIndex)
      setHoveredCol(colIndex)

      const wrapperRect = wrapperEl.getBoundingClientRect()

      // Row Coordinate Offset
      const rowRect = rowEl.getBoundingClientRect()
      setRowCoords({
        top: rowRect.top - wrapperRect.top,
        height: rowRect.height
      })

      // Column Coordinate Offset (from top row header cell)
      const firstRowCells = Array.from(rows[0].children)
      if (colIndex < firstRowCells.length) {
        const headerCell = firstRowCells[colIndex] as HTMLElement
        const headerRect = headerCell.getBoundingClientRect()
        setColCoords({
          left: headerRect.left - wrapperRect.left,
          width: headerRect.width
        })
      }

      // Right boundary
      const tableRect = tableEl.getBoundingClientRect()
      setTableRight(tableRect.right - wrapperRect.left)
    }

    editorDom.addEventListener('pointermove', onPointerMove)
    return () => editorDom.removeEventListener('pointermove', onPointerMove)
  }, [editor, activeMenuRowIndex, activeMenuColIndex])

  // Cell border outlines on hover / menu selections
  useEffect(() => {
    const table = activeTableEl || activeMenuTableEl
    if (!table) return

    const rows = table.querySelectorAll('tr')
    rows.forEach((row, rIdx) => {
      const isRowSel = rIdx === activeMenuRowIndex || (activeMenuRowIndex === null && activeMenuColIndex === null && rIdx === hoveredRow)
      if (isRowSel) {
        row.classList.add('row-selected')
      } else {
        row.classList.remove('row-selected')
      }

      const cells = row.querySelectorAll('td, th')
      cells.forEach((cell, cIdx) => {
        const isColSel = cIdx === activeMenuColIndex || (activeMenuColIndex === null && activeMenuRowIndex === null && cIdx === hoveredCol)
        if (isColSel) {
          cell.classList.add('col-selected')
        } else {
          cell.classList.remove('col-selected')
        }
      })
    })

    // Clean up classes on scroll/active element changes
    return () => {
      rows.forEach(row => {
        row.classList.remove('row-selected')
        row.querySelectorAll('td, th').forEach(cell => {
          cell.classList.remove('col-selected')
        })
      })
    }
  }, [activeTableEl, activeMenuTableEl, hoveredRow, hoveredCol, activeMenuRowIndex, activeMenuColIndex])

  const getCellElement = (tableEl: HTMLTableElement, rIdx: number, cIdx: number): HTMLElement | null => {
    const rows = tableEl.querySelectorAll('tr')
    if (rIdx >= rows.length) return null
    const cells = rows[rIdx].querySelectorAll('td, th')
    if (cIdx >= cells.length) return null
    return cells[cIdx] as HTMLElement
  }

  const focusCell = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    const cellEl = getCellElement(tableEl, rIdx, cIdx)
    if (!cellEl) return
    editor.commands.focus()
    const pos = editor.view.posAtDOM(cellEl, 0)
    editor.commands.setTextSelection(pos)
  }

  // --- Overlay Actions ---

  const handleToggleHeaderRow = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.toggleHeaderRow()
  }

  const handleToggleHeaderCol = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.toggleHeaderColumn()
  }

  const handleInsertLeft = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.addColumnBefore()
  }

  const handleInsertRight = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.addColumnAfter()
  }

  const handleInsertAbove = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.addRowBefore()
  }

  const handleInsertBelow = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.addRowAfter()
  }

  const handleDeleteCol = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.deleteColumn()
    setActiveMenuColIndex(null)
  }

  const handleDeleteRow = (tableEl: HTMLTableElement, rIdx: number, cIdx: number) => {
    focusCell(tableEl, rIdx, cIdx)
    editor.commands.deleteRow()
    setActiveMenuRowIndex(null)
  }

  const setRowBackgroundColor = (tableEl: HTMLTableElement, rowIdx: number, colorVal: string) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    const tr = editor.state.tr
    
    let targetRow: any = null
    let targetRowOffset = -1
    let currentIdx = 0
    node.forEach((row: any, rOffset: number) => {
      if (currentIdx === rowIdx) {
        targetRow = row
        targetRowOffset = rOffset
      }
      currentIdx++
    })

    if (targetRow && targetRowOffset > -1) {
      let cellOffset = 0
      targetRow.forEach((cell: any) => {
        const cellPos = tableNodePos + 1 + targetRowOffset + 1 + cellOffset
        tr.setNodeMarkup(cellPos, null, {
          ...cell.attrs,
          backgroundColor: colorVal
        })
        cellOffset += cell.nodeSize
      })
      editor.view.dispatch(tr)
    }
  }

  const setColBackgroundColor = (tableEl: HTMLTableElement, colIdx: number, colorVal: string) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    const tr = editor.state.tr

    node.forEach((row: any, rOffset: number) => {
      let cCount = 0
      row.forEach((cell: any, cOffset: number) => {
        if (cCount === colIdx) {
          const cellPos = tableNodePos + 1 + rOffset + 1 + cOffset
          tr.setNodeMarkup(cellPos, null, {
            ...cell.attrs,
            backgroundColor: colorVal
          })
        }
        cCount++
      })
    })
    editor.view.dispatch(tr)
  }

  const handleDuplicateRow = (tableEl: HTMLTableElement, rowIdx: number) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    
    let targetRow: any = null
    let targetRowOffset = -1
    let currentIdx = 0
    node.forEach((row: any, rOffset: number) => {
      if (currentIdx === rowIdx) {
        targetRow = row
        targetRowOffset = rOffset
      }
      currentIdx++
    })

    if (targetRow && targetRowOffset > -1) {
      const tr = editor.state.tr
      const insertPos = tableNodePos + 1 + targetRowOffset + targetRow.nodeSize
      tr.insert(insertPos, targetRow.copy(targetRow.content))
      editor.view.dispatch(tr)
    }
  }

  const handleDuplicateCol = (tableEl: HTMLTableElement, colIdx: number) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    const tr = editor.state.tr
    let offset = 0

    node.forEach((row: any, rOffset: number) => {
      let cCount = 0
      row.forEach((cell: any, cOffset: number) => {
        if (cCount === colIdx) {
          const cellPos = tableNodePos + 1 + rOffset + 1 + cOffset
          const insertPos = cellPos + cell.nodeSize + offset
          tr.insert(insertPos, cell.copy(cell.content))
          offset += cell.nodeSize
        }
        cCount++
      })
    })
    editor.view.dispatch(tr)
  }

  const handleClearRowContents = (tableEl: HTMLTableElement, rowIdx: number) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    
    let targetRow: any = null
    let targetRowOffset = -1
    let currentIdx = 0
    node.forEach((row: any, rOffset: number) => {
      if (currentIdx === rowIdx) {
        targetRow = row
        targetRowOffset = rOffset
      }
      currentIdx++
    })

    if (targetRow && targetRowOffset > -1) {
      const tr = editor.state.tr
      let cellOffset = 0
      targetRow.forEach((cell: any) => {
        const cellPos = tableNodePos + 1 + targetRowOffset + 1 + cellOffset
        const paragraph = editor.schema.nodes.paragraph.create()
        tr.replaceWith(cellPos + 1, cellPos + cell.nodeSize - 1, paragraph)
        cellOffset += cell.nodeSize
      })
      editor.view.dispatch(tr)
    }
  }

  const handleClearColContents = (tableEl: HTMLTableElement, colIdx: number) => {
    const info = getTableInfo(tableEl)
    if (!info) return
    const { pos: tableNodePos, node } = info
    const tr = editor.state.tr

    node.forEach((row: any, rOffset: number) => {
      let cCount = 0
      row.forEach((cell: any, cOffset: number) => {
        if (cCount === colIdx) {
          const cellPos = tableNodePos + 1 + rOffset + 1 + cOffset
          const paragraph = editor.schema.nodes.paragraph.create()
          tr.replaceWith(cellPos + 1, cellPos + cell.nodeSize - 1, paragraph)
        }
        cCount++
      })
    })
    editor.view.dispatch(tr)
  }

  // Actions meta
  const rowActions = [
    { id: 'header-row', label: 'Header row', keyword: 'header top row' },
    { id: 'insert-above', label: 'Insert above', keyword: 'insert above add row top', icon: ArrowUp },
    { id: 'insert-below', label: 'Insert below', keyword: 'insert below add row bottom', icon: ArrowDown },
    { id: 'duplicate', label: 'Duplicate', keyword: 'duplicate copy row', icon: Copy, shortcut: '⌘D' },
    { id: 'clear', label: 'Clear contents', keyword: 'clear erase empty delete text', icon: Eraser },
    { id: 'delete', label: 'Delete', keyword: 'delete remove row', icon: Trash2, danger: true },
  ]

  const colActions = [
    { id: 'header-col', label: 'Header column', keyword: 'header left side column' },
    { id: 'insert-left', label: 'Insert left', keyword: 'insert left add column', icon: ArrowLeft },
    { id: 'insert-right', label: 'Insert right', keyword: 'insert right add column', icon: ArrowRight },
    { id: 'duplicate', label: 'Duplicate', keyword: 'duplicate copy column', icon: Copy, shortcut: '⌘D' },
    { id: 'clear', label: 'Clear contents', keyword: 'clear erase empty delete text', icon: Eraser },
    { id: 'delete', label: 'Delete', keyword: 'delete remove column', icon: Trash2, danger: true },
  ]

  const filteredRowActions = rowActions.filter(a =>
    a.label.toLowerCase().includes(rowSearch.toLowerCase()) ||
    a.keyword.toLowerCase().includes(rowSearch.toLowerCase())
  )

  const filteredColActions = colActions.filter(a =>
    a.label.toLowerCase().includes(colSearch.toLowerCase()) ||
    a.keyword.toLowerCase().includes(colSearch.toLowerCase())
  )

  // Header active state check
  const isHeaderRowActive = useMemo(() => {
    const table = activeTableEl || activeMenuTableEl
    if (activeMenuRowIndex === null || !table) return false
    const rows = table.querySelectorAll('tr')
    if (activeMenuRowIndex >= rows.length) return false
    const cells = rows[activeMenuRowIndex].querySelectorAll('td, th')
    return Array.from(cells).every(c => c.tagName.toLowerCase() === 'th')
  }, [activeMenuRowIndex, activeTableEl, activeMenuTableEl])

  const isHeaderColActive = useMemo(() => {
    const table = activeTableEl || activeMenuTableEl
    if (activeMenuColIndex === null || !table) return false
    const rows = table.querySelectorAll('tr')
    return Array.from(rows).every(row => {
      const cells = row.querySelectorAll('td, th')
      if (activeMenuColIndex >= cells.length) return false
      return cells[activeMenuColIndex].tagName.toLowerCase() === 'th'
    })
  }, [activeMenuColIndex, activeTableEl, activeMenuTableEl])

  // Get active cell colors from ProseMirror Node structure
  const activeRowColor = useMemo(() => {
    const tableEl = activeTableEl || activeMenuTableEl
    if (activeMenuRowIndex === null || !tableEl) return 'Default'
    const info = getTableInfo(tableEl)
    if (!info) return 'Default'
    
    let rowNode: any = null
    let idx = 0
    info.node.forEach((row: any) => {
      if (idx === activeMenuRowIndex) rowNode = row
      idx++
    })
    if (!rowNode) return 'Default'
    
    let firstCellColor = ''
    rowNode.forEach((cell: any) => {
      if (!firstCellColor) firstCellColor = cell.attrs.backgroundColor
    })
    const found = TABLE_COLORS.find(c => c.bg === firstCellColor)
    return found ? found.name : 'Default'
  }, [activeMenuRowIndex, activeTableEl, activeMenuTableEl])

  const activeColColor = useMemo(() => {
    const tableEl = activeTableEl || activeMenuTableEl
    if (activeMenuColIndex === null || !tableEl) return 'Default'
    const info = getTableInfo(tableEl)
    if (!info) return 'Default'

    let firstCellColor = ''
    info.node.forEach((row: any) => {
      let cCount = 0
      row.forEach((cell: any) => {
        if (cCount === activeMenuColIndex && !firstCellColor) {
          firstCellColor = cell.attrs.backgroundColor
        }
        cCount++
      })
    })
    const found = TABLE_COLORS.find(c => c.bg === firstCellColor)
    return found ? found.name : 'Default'
  }, [activeMenuColIndex, activeTableEl, activeMenuTableEl])

  const handleRightAdderClick = () => {
    const table = activeTableEl || activeMenuTableEl
    if (!table) return
    const rows = table.querySelectorAll('tr')
    if (rows.length === 0) return
    const lastCellIndex = rows[0].querySelectorAll('td, th').length - 1
    focusCell(table, 0, lastCellIndex)
    editor.commands.addColumnAfter()
  }

  // Render variables
  const showRowHandle = (hoveredRow !== null && hoveredRow >= 0 && activeTableEl !== null) || activeMenuRowIndex !== null
  const showColHandle = (hoveredCol !== null && hoveredCol >= 0 && activeTableEl !== null) || activeMenuColIndex !== null
  const showRightAdder = activeTableEl !== null && tableRight !== null

  return (
    <div className="table-handle-overlay pointer-events-none absolute inset-0 z-30">
      {/* ─── Column Handle Overlay ─── */}
      {showColHandle && colCoords && editor.isEditable && (
        <div 
          className="absolute pointer-events-auto flex items-center justify-center group/col-handle-container"
          style={{
            left: `${colCoords.left + colCoords.width / 2 - 12}px`,
            top: `${(activeTableEl || activeMenuTableEl)!.getBoundingClientRect().top - (activeTableEl || activeMenuTableEl)!.closest('.simple-editor-wrapper')!.getBoundingClientRect().top - 12}px`,
            width: '24px',
            height: '12px'
          }}
          onPointerEnter={clearHideTimeout}
          onPointerLeave={startHideTimeout}
        >
          <Popover 
            open={activeMenuColIndex !== null} 
            onOpenChange={(open) => {
              if (open) {
                setActiveMenuColIndex(hoveredCol)
                setActiveMenuTableEl(activeTableEl)
                setColSearch('')
                clearHideTimeout()
              } else {
                setActiveMenuColIndex(null)
                setActiveMenuTableEl(null)
                startHideTimeout()
              }
            }}
          >
            <PopoverTrigger asChild>
              <button 
                type="button"
                className={`flex flex-col items-center justify-center w-6 h-3.5 rounded hover:bg-muted text-muted-foreground transition-all group/col-btn ${activeMenuColIndex !== null ? 'bg-primary text-primary-foreground hover:bg-primary/95 h-5 w-6' : ''}`}
                title="Column actions"
              >
                {/* Default Horizontal pill/dash (bold edge indicator) */}
                <div className={`w-4 h-0.5 rounded bg-muted-foreground/30 group-hover/col-btn:hidden ${activeMenuColIndex !== null ? 'hidden' : ''}`} />
                {/* 6-dots grip icon on hover */}
                <GripVertical className={`size-3 hidden group-hover/col-btn:block ${activeMenuColIndex !== null ? 'block' : ''}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              align="center" 
              side="top"
              sideOffset={4}
              className="w-[240px] p-0 rounded-xl shadow-lg border border-border bg-popover overflow-hidden flex flex-col max-h-[400px]"
            >
              <div className="p-2 pb-0">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/50 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    placeholder="Search actions..."
                    className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/60"
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1.5 custom-scrollbar">
                {filteredColActions.map(action => {
                  if (action.id === 'header-col') {
                    return (
                      <div 
                        key={action.id}
                        className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleToggleHeaderCol((activeTableEl || activeMenuTableEl)!, 0, activeMenuColIndex!)}
                      >
                        <span className="text-xs font-medium">{action.label}</span>
                        <Switch size="sm" checked={isHeaderColActive} className="pointer-events-none" />
                      </div>
                    )
                  }

                  const Icon = action.icon!
                  return (
                    <div
                      key={action.id}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group ${action.danger ? 'hover:text-destructive' : ''}`}
                      onClick={() => {
                        const table = (activeTableEl || activeMenuTableEl)!
                        if (action.id === 'insert-left') handleInsertLeft(table, 0, activeMenuColIndex!)
                        if (action.id === 'insert-right') handleInsertRight(table, 0, activeMenuColIndex!)
                        if (action.id === 'duplicate') handleDuplicateCol(table, activeMenuColIndex!)
                        if (action.id === 'clear') handleClearColContents(table, activeMenuColIndex!)
                        if (action.id === 'delete') handleDeleteCol(table, 0, activeMenuColIndex!)
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`size-4 text-muted-foreground group-hover:text-foreground transition-colors ${action.danger ? 'group-hover:text-destructive' : ''}`} />
                        <span className="text-xs font-medium">{action.label}</span>
                      </div>
                      {action.shortcut && (
                        <span className="text-[10px] text-muted-foreground/50">{action.shortcut}</span>
                      )}
                    </div>
                  )
                })}

                {/* Color Selector */}
                {colSearch === '' && (
                  <>
                    <div className="h-px bg-border/50 my-1.5" />
                    <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cell Background
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 p-3">
                      {TABLE_COLORS.map(color => (
                        <button
                          key={color.name}
                          type="button"
                          className={`w-7 h-7 rounded border border-border/20 flex items-center justify-center transition-all hover:scale-115 ${color.labelBg}`}
                          title={color.name}
                          onClick={() => setColBackgroundColor((activeTableEl || activeMenuTableEl)!, activeMenuColIndex!, color.bg)}
                        >
                          {activeColColor === color.name && (
                            <Check className="size-3 text-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ─── Row Controls Overlay (Plus + Drag Handle) ─── */}
      {showRowHandle && rowCoords && editor.isEditable && (
        <div 
          className="absolute flex items-center gap-1.5 pointer-events-auto group/row-handle-container"
          style={{
            left: `${(activeTableEl || activeMenuTableEl)!.getBoundingClientRect().left - (activeTableEl || activeMenuTableEl)!.closest('.simple-editor-wrapper')!.getBoundingClientRect().left - 36}px`,
            top: `${rowCoords.top + rowCoords.height / 2 - 12}px`,
            width: '32px',
            height: '24px',
            justifyContent: 'flex-end'
          }}
          onPointerEnter={clearHideTimeout}
          onPointerLeave={startHideTimeout}
        >
          {/* Plus button to add row below - fades in on container hover */}
          <button
            type="button"
            className="flex items-center justify-center size-4.5 rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground opacity-0 group-hover/row-handle-container:opacity-100 transition-opacity"
            title="Add row below"
            onClick={() => handleInsertBelow((activeTableEl || activeMenuTableEl)!, hoveredRow !== null ? hoveredRow : activeMenuRowIndex!, 0)}
          >
            <Plus className="size-3.5" />
          </button>

          {/* Row handle popover */}
          <Popover 
            open={activeMenuRowIndex !== null}
            onOpenChange={(open) => {
              if (open) {
                setActiveMenuRowIndex(hoveredRow)
                setActiveMenuTableEl(activeTableEl)
                setRowSearch('')
                clearHideTimeout()
              } else {
                setActiveMenuRowIndex(null)
                setActiveMenuTableEl(null)
                startHideTimeout()
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`flex items-center justify-center w-4.5 h-5 rounded hover:bg-muted text-muted-foreground transition-all group/row-btn ${activeMenuRowIndex !== null ? 'bg-primary text-primary-foreground hover:bg-primary/95' : ''}`}
                title="Row actions"
              >
                {/* Default Vertical line (bold edge indicator) */}
                <div className={`w-0.5 h-3.5 rounded bg-muted-foreground/30 group-hover/row-btn:hidden ${activeMenuRowIndex !== null ? 'hidden' : ''}`} />
                {/* 6-dots grip icon on hover */}
                <GripVertical className={`size-3.5 hidden group-hover/row-btn:block ${activeMenuRowIndex !== null ? 'block' : ''}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="left"
              sideOffset={4}
              className="w-[240px] p-0 rounded-xl shadow-lg border border-border bg-popover overflow-hidden flex flex-col max-h-[400px]"
            >
              <div className="p-2 pb-0">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/50 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    placeholder="Search actions..."
                    className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/60"
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1.5 custom-scrollbar">
                {filteredRowActions.map(action => {
                  if (action.id === 'header-row') {
                    return (
                      <div 
                        key={action.id}
                        className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleToggleHeaderRow((activeTableEl || activeMenuTableEl)!, activeMenuRowIndex!, 0)}
                      >
                        <span className="text-xs font-medium">{action.label}</span>
                        <Switch size="sm" checked={isHeaderRowActive} className="pointer-events-none" />
                      </div>
                    )
                  }

                  const Icon = action.icon!
                  return (
                    <div
                      key={action.id}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors group ${action.danger ? 'hover:text-destructive' : ''}`}
                      onClick={() => {
                        const table = (activeTableEl || activeMenuTableEl)!
                        if (action.id === 'insert-above') handleInsertAbove(table, activeMenuRowIndex!, 0)
                        if (action.id === 'insert-below') handleInsertBelow(table, activeMenuRowIndex!, 0)
                        if (action.id === 'duplicate') handleDuplicateRow(table, activeMenuRowIndex!)
                        if (action.id === 'clear') handleClearRowContents(table, activeMenuRowIndex!)
                        if (action.id === 'delete') handleDeleteRow(table, activeMenuRowIndex!, 0)
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`size-4 text-muted-foreground group-hover:text-foreground transition-colors ${action.danger ? 'group-hover:text-destructive' : ''}`} />
                        <span className="text-xs font-medium">{action.label}</span>
                      </div>
                      {action.shortcut && (
                        <span className="text-[10px] text-muted-foreground/50">{action.shortcut}</span>
                      )}
                    </div>
                  )
                })}

                {/* Color Selector */}
                {rowSearch === '' && (
                  <>
                    <div className="h-px bg-border/50 my-1.5" />
                    <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cell Background
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 p-3">
                      {TABLE_COLORS.map(color => (
                        <button
                          key={color.name}
                          type="button"
                          className={`w-7 h-7 rounded border border-border/20 flex items-center justify-center transition-all hover:scale-115 ${color.labelBg}`}
                          title={color.name}
                          onClick={() => setRowBackgroundColor((activeTableEl || activeMenuTableEl)!, activeMenuRowIndex!, color.bg)}
                        >
                          {activeRowColor === color.name && (
                            <Check className="size-3 text-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Last Edited Footer */}
                {rowSearch === '' && lastEditedMeta && (
                  <>
                    <div className="h-px bg-border/50 my-1.5" />
                    <div className="px-3 py-2 bg-muted/20 text-[10px] text-muted-foreground/70 flex flex-col gap-0.5">
                      <span>Last edited by {lastEditedMeta.name}</span>
                      <span>{lastEditedMeta.date}</span>
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ─── Right Edge Column Adder Strip ─── */}
      {showRightAdder && editor.isEditable && (
        <div
          className="absolute pointer-events-auto w-2.5 cursor-pointer flex items-center justify-center hover:opacity-100 opacity-0 transition-opacity"
          style={{
            left: `${tableRight + 4}px`,
            top: `${(activeTableEl || activeMenuTableEl)!.getBoundingClientRect().top - (activeTableEl || activeMenuTableEl)!.closest('.simple-editor-wrapper')!.getBoundingClientRect().top}px`,
            height: `${(activeTableEl || activeMenuTableEl)!.getBoundingClientRect().height}px`,
          }}
          onClick={handleRightAdderClick}
          onPointerEnter={clearHideTimeout}
          onPointerLeave={startHideTimeout}
        >
          {/* Vertical line indicator */}
          <div className="w-1 h-full rounded-full bg-primary/40 hover:bg-primary transition-colors" />
        </div>
      )}
    </div>
  )
}
