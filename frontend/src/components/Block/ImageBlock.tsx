import React, { type FC, useState, useRef, useCallback } from 'react';
import type { Block } from '../../types/block';
import { useBlockStore } from '../../store/useBlockStore';
import { Image as ImageIcon, FileText, Upload, Link, HardDrive, X } from 'lucide-react';

interface ImageBlockProps {
  block: Block;
  isPdf?: boolean;
}

type Tab = 'upload' | 'url';

const ImageBlock: FC<ImageBlockProps> = ({ block, isPdf }) => {
  const updateBlock = useBlockStore(state => state.updateBlock);
  const [isEditing, setIsEditing] = useState(!block.content?.url);
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept = isPdf ? 'application/pdf' : 'image/*';

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      updateBlock(block.id, { content: { ...block.content, url: dataUrl, fileName: file.name } });
      setIsEditing(false);
    };
    reader.readAsDataURL(file);
  }, [block.id, block.content, updateBlock]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      updateBlock(block.id, { content: { ...block.content, url: url.trim() } });
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden my-2">
        {/* Tab headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <HardDrive size={14} />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Link size={14} />
            Embed link
          </button>
        </div>

        {/* Tab content */}
        <div className="p-6 bg-white dark:bg-gray-900">
          {activeTab === 'upload' ? (
            <div
              className={`flex flex-col items-center justify-center gap-4 min-h-[160px] border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-2 text-gray-400">
                {isPdf
                  ? <FileText size={36} className={isDragging ? 'text-blue-500' : ''} />
                  : <ImageIcon size={36} className={isDragging ? 'text-blue-500' : ''} />
                }
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isDragging ? 'Drop to upload' : `Click to upload or drag & drop`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isPdf ? 'PDF files only' : 'PNG, JPG, GIF, WEBP, SVG'}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={isPdf ? 'Paste a public PDF URL...' : 'Paste an image URL...'}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
              <button
                type="submit"
                disabled={!url.trim()}
                className="self-start px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Embed
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Rendered view
  const alignClass =
    block.properties?.alignment === 'center' ? 'flex justify-center' :
    block.properties?.alignment === 'right' ? 'flex justify-end' :
    'flex justify-start';

  return (
    <div className={`group relative my-2 ${alignClass}`}>
      {isPdf ? (
        <div className="w-full">
          <iframe
            src={block.content?.url}
            title={block.content?.fileName || block.content?.caption || 'PDF document'}
            className="w-full h-[600px] border border-gray-200 dark:border-gray-800 rounded-md"
          />
          {block.content?.fileName && (
            <p className="text-xs text-gray-400 mt-1 text-center">{block.content.fileName}</p>
          )}
        </div>
      ) : (
        <div className="relative">
          <img
            src={block.content?.url}
            alt={block.content?.caption || 'Block image'}
            className="max-w-full rounded-md object-contain"
            style={{ maxHeight: '500px' }}
          />
          {block.content?.caption && (
            <p className="text-center text-sm text-gray-500 mt-2">{block.content.caption}</p>
          )}
        </div>
      )}

      {/* Hover controls */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setIsEditing(true); setUrl(''); }}
          title="Replace"
          className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-md backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <Upload size={14} className="text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={() => updateBlock(block.id, { content: { url: '', fileName: '' } })}
          title="Clear"
          className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-md backdrop-blur-sm shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <X size={14} className="text-gray-600 dark:text-red-400" />
        </button>
      </div>
    </div>
  );
};

export default ImageBlock;
