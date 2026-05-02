export type BlockType = 
  | 'text' 
  | 'h1' | 'h2' | 'h3'
  | 'image' | 'pdf'
  | 'code' 
  | 'bullet-list' | 'numbered-list' | 'todo-list'
  | 'table' 
  | 'quote' 
  | 'toggle'
  | 'embed'
  | 'divider'
  | 'subpage';

export interface Block {
  id: string;
  type: BlockType;
  content: any;
  properties: BlockProperties;
  parent?: string;
  children?: string[];
  metadata: BlockMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface BlockProperties {
  color?: string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right';
  isFocused?: boolean;
  isSelected?: boolean;
  level?: number; // for headings and indentation
  checked?: boolean;
}

export interface BlockMetadata {
  version: number;
  lastEditedBy?: string;
  deleted?: boolean;
}

export interface Page {
  id: string;
  title: string;
  blocks: string[]; // array of block IDs
  createdAt: number;
  updatedAt: number;
}
