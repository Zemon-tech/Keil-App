import { config } from '../config';
import { integrationRepository, motionPageRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { createServiceLogger } from '../lib/logger';
import pool from '../config/pg';
import { MotionPageDTO } from './motion-page.service';

const log = createServiceLogger('notion-integration');
const PROVIDER = 'notion';
const NOTION_API_VERSION = '2026-03-11';

// ─── Bidirectional TipTap <-> Markdown Converters ────────────────────────────────

export function markdownToTiptap(markdown: string): any {
  if (!markdown) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const lines = markdown.split(/\r?\n/);
  const content: any[] = [];
  
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  
  let currentList: { type: 'bulletList' | 'orderedList' | 'taskList'; items: any[] } | null = null;
  let currentTable: { headers: string[]; rows: string[][] } | null = null;

  const flushList = () => {
    if (currentList) {
      content.push({
        type: currentList.type,
        content: currentList.items,
      });
      currentList = null;
    }
  };

  const flushTable = () => {
    if (currentTable && currentTable.headers.length > 0) {
      const tableRows: any[] = [];
      
      // Add header row
      const headerCells = currentTable.headers.map(header => ({
        type: 'tableHeader',
        content: [{ type: 'paragraph', content: parseInline(header) }]
      }));
      tableRows.push({
        type: 'tableRow',
        content: headerCells
      });
      
      // Add data rows
      for (const row of currentTable.rows) {
        const cells = row.map(cell => ({
          type: 'tableCell',
          content: [{ type: 'paragraph', content: parseInline(cell) }]
        }));
        tableRows.push({
          type: 'tableRow',
          content: cells
        });
      }
      
      content.push({
        type: 'table',
        content: tableRows
      });
      currentTable = null;
    }
  };

  const parseInline = (text: string): any[] => {
    if (!text) return [];
    
    const results: any[] = [];
    let remaining = text;
    
    while (remaining) {
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const italicMatch = remaining.match(/\*([^*]+)\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      const strikeMatch = remaining.match(/~~([^~]+)~~/);
      
      const matches = [
        { name: 'link', match: linkMatch, index: linkMatch?.index ?? -1 },
        { name: 'bold', match: boldMatch, index: boldMatch?.index ?? -1 },
        { name: 'italic', match: italicMatch, index: italicMatch?.index ?? -1 },
        { name: 'code', match: codeMatch, index: codeMatch?.index ?? -1 },
        { name: 'strike', match: strikeMatch, index: strikeMatch?.index ?? -1 },
      ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);
      
      if (matches.length === 0) {
        results.push({ type: 'text', text: remaining });
        break;
      }
      
      const first = matches[0];
      const matchIndex = first.index;
      
      if (matchIndex > 0) {
        results.push({ type: 'text', text: remaining.substring(0, matchIndex) });
      }
      
      const matchText = first.match![1];
      const fullMatchLength = first.match![0].length;
      
      if (first.name === 'link') {
        const url = first.match![2];
        results.push({
          type: 'text',
          text: matchText,
          marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }]
        });
      } else if (first.name === 'bold') {
        results.push({
          type: 'text',
          text: matchText,
          marks: [{ type: 'bold' }]
        });
      } else if (first.name === 'italic') {
        results.push({
          type: 'text',
          text: matchText,
          marks: [{ type: 'italic' }]
        });
      } else if (first.name === 'code') {
        results.push({
          type: 'text',
          text: matchText,
          marks: [{ type: 'code' }]
        });
      } else if (first.name === 'strike') {
        results.push({
          type: 'text',
          text: matchText,
          marks: [{ type: 'strike' }]
        });
      }
      
      remaining = remaining.substring(matchIndex + fullMatchLength);
    }
    
    return results;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        content.push({
          type: 'codeBlock',
          attrs: { language: codeLanguage || 'javascript' },
          content: [{ type: 'text', text: codeLines.join('\n') }],
        });
        inCodeBlock = false;
        codeLanguage = '';
        codeLines = [];
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeLanguage = line.trim().substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === '') {
      flushList();
      flushTable();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      content.push({
        type: 'heading',
        attrs: { level: Math.min(level, 3) },
        content: parseInline(headingMatch[2]),
      });
      continue;
    }

    if (line.trim().startsWith('>')) {
      flushList();
      flushTable();
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInline(line.trim().substring(1).trim()),
        }],
      });
      continue;
    }

    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      flushTable();
      if (currentList && currentList.type !== 'taskList') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'taskList', items: [] };
      }
      const checked = taskMatch[1].toLowerCase() === 'x';
      currentList.items.push({
        type: 'taskItem',
        attrs: { checked },
        content: [{
          type: 'paragraph',
          content: parseInline(taskMatch[2]),
        }],
      });
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushTable();
      if (currentList && currentList.type !== 'bulletList') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'bulletList', items: [] };
      }
      currentList.items.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: parseInline(bulletMatch[1]),
        }],
      });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushTable();
      if (currentList && currentList.type !== 'orderedList') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'orderedList', items: [] };
      }
      currentList.items.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: parseInline(orderedMatch[2]),
        }],
      });
      continue;
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushList();
      flushTable();
      content.push({
        type: 'image',
        attrs: { src: imageMatch[2] },
      });
      continue;
    }

    if (line.trim() === '---') {
      flushList();
      flushTable();
      content.push({
        type: 'horizontalRule',
      });
      continue;
    }

    // Markdown table parsing
    const tableRowMatch = line.match(/^\|(.+)\|$/);
    if (tableRowMatch) {
      flushList();
      
      const cells = tableRowMatch[1].split('|').map(cell => cell.trim());
      
      // Check if this is a separator row (e.g., |---|---|)
      const isSeparator = cells.every(cell => /^[-:]+$/.test(cell));
      
      if (isSeparator) {
        // Separator row marks the end of headers
        if (currentTable) {
          // Headers already captured, just continue
        } else {
          // No headers before separator, skip
        }
      } else {
        if (!currentTable) {
          // First row is headers
          currentTable = { headers: cells, rows: [] };
        } else {
          // Subsequent rows are data
          currentTable.rows.push(cells);
        }
      }
      continue;
    }

    // If we're not in a table row anymore, flush the table
    if (currentTable) {
      flushTable();
    }

    content.push({
      type: 'paragraph',
      content: parseInline(line),
    });
  }

  flushList();
  flushTable();

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

export function tiptapToMarkdown(tiptapDoc: any): string {
  if (!tiptapDoc || !tiptapDoc.content) return '';
  
  const markdownLines: string[] = [];
  
  const inlineToMarkdown = (inlineNodes?: any[]): string => {
    if (!inlineNodes || inlineNodes.length === 0) return '';
    
    return inlineNodes.map(node => {
      if (node.type !== 'text') return '';
      let text = node.text || '';
      
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') text = `**${text}**`;
          if (mark.type === 'italic') text = `*${text}*`;
          if (mark.type === 'strike') text = `~~${text}~~`;
          if (mark.type === 'code') text = `\`${text}\``;
          if (mark.type === 'link' && mark.attrs?.href) {
            text = `[${text}](${mark.attrs.href})`;
          }
        }
      }
      return text;
    }).join('');
  };

  for (const node of tiptapDoc.content) {
    switch (node.type) {
      case 'paragraph':
        markdownLines.push(inlineToMarkdown(node.content));
        markdownLines.push('');
        break;
      case 'heading':
        const level = node.attrs?.level || 1;
        const prefix = '#'.repeat(level);
        markdownLines.push(`${prefix} ${inlineToMarkdown(node.content)}`);
        markdownLines.push('');
        break;
      case 'blockquote':
        const blockquoteContent = node.content?.map((c: any) => inlineToMarkdown(c.content)).join('\n') || '';
        markdownLines.push(`> ${blockquoteContent}`);
        markdownLines.push('');
        break;
      case 'codeBlock':
        const codeText = node.content?.[0]?.text || '';
        const lang = node.attrs?.language || 'javascript';
        markdownLines.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
        markdownLines.push('');
        break;
      case 'bulletList':
        if (node.content) {
          for (const item of node.content) {
            const itemText = inlineToMarkdown(item.content?.[0]?.content);
            markdownLines.push(`- ${itemText}`);
            if (item.content?.length > 1) {
              const nestedMarkdown = tiptapToMarkdown({ content: item.content.slice(1) });
              const indented = nestedMarkdown.split('\n').map(line => line ? '  ' + line : '').join('\n');
              markdownLines.push(indented);
            }
          }
          markdownLines.push('');
        }
        break;
      case 'orderedList':
        if (node.content) {
          let count = 1;
          for (const item of node.content) {
            const itemText = inlineToMarkdown(item.content?.[0]?.content);
            markdownLines.push(`${count}. ${itemText}`);
            count++;
            if (item.content?.length > 1) {
              const nestedMarkdown = tiptapToMarkdown({ content: item.content.slice(1) });
              const indented = nestedMarkdown.split('\n').map(line => line ? '  ' + line : '').join('\n');
              markdownLines.push(indented);
            }
          }
          markdownLines.push('');
        }
        break;
      case 'taskList':
        if (node.content) {
          for (const item of node.content) {
            const itemText = inlineToMarkdown(item.content?.[0]?.content);
            const box = item.attrs?.checked ? '[x]' : '[ ]';
            markdownLines.push(`- ${box} ${itemText}`);
            if (item.content?.length > 1) {
              const nestedMarkdown = tiptapToMarkdown({ content: item.content.slice(1) });
              const indented = nestedMarkdown.split('\n').map(line => line ? '  ' + line : '').join('\n');
              markdownLines.push(indented);
            }
          }
          markdownLines.push('');
        }
        break;
      case 'image':
        if (node.attrs?.src) {
          markdownLines.push(`![image](${node.attrs.src})`);
          markdownLines.push('');
        }
        break;
      case 'horizontalRule':
        markdownLines.push('---');
        markdownLines.push('');
        break;
      default:
        break;
    }
  }

  return markdownLines.join('\n').trim();
}

// ─── OAuth & Token Management ───────────────────────────────────────────────────

export function getNotionAuthUrl(userId: string): string {
  if (!config.notionClientId || !config.notionRedirectUri) {
    throw new ApiError(500, 'Notion integration is not configured on this server');
  }

  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.append('client_id', config.notionClientId);
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('owner', 'user');
  url.searchParams.append('redirect_uri', config.notionRedirectUri);
  url.searchParams.append('state', userId);

  return url.toString();
}

export async function handleNotionCallback(code: string, state: string): Promise<{ userId: string }> {
  const userId = state;
  if (!userId) {
    throw new ApiError(400, 'Invalid state parameter');
  }

  if (!config.notionClientId || !config.notionClientSecret) {
    throw new ApiError(500, 'Notion integration is not configured on this server');
  }

  log.info({ userId }, 'Exchanging Notion code for token');

  const authHeader = Buffer.from(`${config.notionClientId}:${config.notionClientSecret}`).toString('base64');

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.notionRedirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText }, 'Failed to exchange Notion auth code');
    throw new ApiError(500, 'Failed to obtain Notion access token');
  }

  const tokenData = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    workspace_name?: string;
    workspace_icon?: string;
    workspace_id?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    log.error({ tokenData }, 'Notion OAuth error response');
    throw new ApiError(400, tokenData.error_description || 'Notion authorization failed');
  }

  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || '',
    token_expiry: null,
    calendar_id: tokenData.workspace_name || 'Notion Workspace',
  });

  log.info({ userId }, 'Notion integration saved');

  return { userId };
}

export async function connectNotionWithManualToken(userId: string, token: string, workspaceName?: string): Promise<void> {
  if (!token) {
    throw new ApiError(400, 'Integration token is required');
  }

  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: token,
    refresh_token: '',
    token_expiry: null,
    calendar_id: workspaceName?.trim() || 'Custom Integration',
  });

  log.info({ userId }, 'Notion integration manually saved');
}

async function getNotionHeaders(userId: string): Promise<Record<string, string>> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration || !integration.access_token) {
    throw new ApiError(401, 'Notion is not connected');
  }
  return {
    Authorization: `Bearer ${integration.access_token}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };
}

export async function refreshNotionToken(userId: string): Promise<string> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration || !integration.refresh_token) {
    throw new ApiError(401, 'Notion is not connected or no refresh token available');
  }

  if (!config.notionClientId || !config.notionClientSecret) {
    throw new ApiError(500, 'Notion integration is not configured on this server');
  }

  log.info({ userId }, 'Refreshing Notion access token');

  const authHeader = Buffer.from(`${config.notionClientId}:${config.notionClientSecret}`).toString('base64');
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
  });

  if (!response.ok) {
    log.error({ userId, status: response.status }, 'Failed to refresh Notion token');
    throw new ApiError(response.status, 'Failed to refresh Notion access token');
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    workspace_name?: string;
  };

  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || integration.refresh_token,
    token_expiry: null,
    calendar_id: data.workspace_name || integration.calendar_id || 'Notion Workspace',
  });

  return data.access_token;
}

async function fetchNotion(
  userId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let headers = await getNotionHeaders(userId);
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...headers,
    },
  });

  if (response.status === 401) {
    log.info({ userId }, 'Notion API returned 401. Attempting token refresh...');
    const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
    if (integration && integration.refresh_token) {
      try {
        const newAccessToken = await refreshNotionToken(userId);
        headers = {
          ...headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...headers,
          },
        });
      } catch (err) {
        log.error({ userId, err }, 'Failed to automatically refresh Notion token');
      }
    }
  }

  return response;
}

// ─── Notion API Interactivity ───────────────────────────────────────────────────

function richTextToMarkdown(richText: any[]): string {
  if (!richText || richText.length === 0) return '';
  return richText.map(chunk => {
    let text = chunk.plain_text || '';
    if (!text) return '';
    
    const { bold, italic, strikethrough, code } = chunk.annotations || {};
    
    if (code) text = `\`${text}\``;
    if (bold) text = `**${text}**`;
    if (italic) text = `*${text}*`;
    if (strikethrough) text = `~~${text}~~`;
    
    if (chunk.href) {
      text = `[${text}](${chunk.href})`;
    }
    
    return text;
  }).join('');
}

export function notionRichTextToTiptapInline(richText: any[]): any[] {
  if (!richText || richText.length === 0) return [];
  return richText.map(chunk => {
    const text = chunk.plain_text || chunk.text?.content || '';
    if (!text) return null;

    const marks: any[] = [];
    const { bold, italic, strikethrough, code } = chunk.annotations || {};

    if (bold) marks.push({ type: 'bold' });
    if (italic) marks.push({ type: 'italic' });
    if (strikethrough) marks.push({ type: 'strike' });
    if (code) marks.push({ type: 'code' });
    if (chunk.href) {
      marks.push({ type: 'link', attrs: { href: chunk.href, target: '_blank' } });
    }

    const node: any = { type: 'text', text };
    if (marks.length > 0) {
      node.marks = marks;
    }
    return node;
  }).filter(Boolean);
}

export function tiptapInlineToNotionRichText(inlineNodes: any[]): any[] {
  if (!inlineNodes || inlineNodes.length === 0) return [];
  return inlineNodes.map(node => {
    if (node.type !== 'text') return null;
    const text = node.text || '';
    
    const annotations: any = {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default'
    };
    let href: string | undefined = undefined;

    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') annotations.bold = true;
        if (mark.type === 'italic') annotations.italic = true;
        if (mark.type === 'strike') annotations.strikethrough = true;
        if (mark.type === 'code') annotations.code = true;
        if (mark.type === 'link' && mark.attrs?.href) {
          href = mark.attrs.href;
        }
      }
    }

    const richText: any = {
      type: 'text',
      text: { content: text },
      annotations
    };

    if (href) {
      richText.text.link = { url: href };
    }

    return richText;
  }).filter(Boolean);
}

function extractCellInlineContent(cellNode: any): any[] {
  if (!cellNode || !cellNode.content) return [];
  const inlineNodes: any[] = [];
  for (const block of cellNode.content) {
    if (block.type === 'paragraph' && block.content) {
      inlineNodes.push(...block.content);
      inlineNodes.push({ type: 'text', text: '\n' });
    } else if (block.type === 'text') {
      inlineNodes.push(block);
    }
  }
  if (inlineNodes.length > 0 && inlineNodes[inlineNodes.length - 1].text === '\n') {
    inlineNodes.pop();
  }
  return inlineNodes;
}

export function tiptapToNotionBlocks(content: any[]): any[] {
  if (!content || !Array.isArray(content)) return [];
  
  const blocks: any[] = [];
  
  for (const node of content) {
    switch (node.type) {
      case 'paragraph': {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: tiptapInlineToNotionRichText(node.content)
          }
        });
        break;
      }
      case 'heading': {
        const level = Math.min(node.attrs?.level || 1, 3);
        blocks.push({
          object: 'block',
          type: `heading_${level}`,
          [`heading_${level}`]: {
            rich_text: tiptapInlineToNotionRichText(node.content),
            is_toggleable: false
          }
        });
        break;
      }
      case 'blockquote': {
        let richText: any[] = [];
        if (node.content) {
          const firstChild = node.content[0];
          if (firstChild && firstChild.type === 'paragraph') {
            richText = tiptapInlineToNotionRichText(firstChild.content);
          }
        }
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: richText
          }
        });
        break;
      }
      case 'codeBlock': {
        const codeText = node.content?.[0]?.text || '';
        const lang = node.attrs?.language || 'javascript';
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeText } }],
            language: lang
          }
        });
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const type = node.type === 'bulletList' ? 'bulleted_list_item' : 'numbered_list_item';
        if (node.content) {
          for (const item of node.content) {
            const firstChild = item.content?.[0];
            const itemRichText = firstChild && firstChild.type === 'paragraph'
              ? tiptapInlineToNotionRichText(firstChild.content)
              : [];
            
            const nestedBlocks = item.content?.length > 1
              ? tiptapToNotionBlocks(item.content.slice(1))
              : undefined;

            const blockObj: any = {
              object: 'block',
              type,
              [type]: {
                rich_text: itemRichText
              }
            };

            if (nestedBlocks && nestedBlocks.length > 0) {
              blockObj[type].children = nestedBlocks;
            }

            blocks.push(blockObj);
          }
        }
        break;
      }
      case 'taskList': {
        if (node.content) {
          for (const item of node.content) {
            const firstChild = item.content?.[0];
            const itemRichText = firstChild && firstChild.type === 'paragraph'
              ? tiptapInlineToNotionRichText(firstChild.content)
              : [];
            const checked = !!item.attrs?.checked;

            const nestedBlocks = item.content?.length > 1
              ? tiptapToNotionBlocks(item.content.slice(1))
              : undefined;

            const blockObj: any = {
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: itemRichText,
                checked
              }
            };

            if (nestedBlocks && nestedBlocks.length > 0) {
              blockObj.to_do.children = nestedBlocks;
            }

            blocks.push(blockObj);
          }
        }
        break;
      }
      case 'details': {
        const summaryNode = node.content?.find((c: any) => c.type === 'detailsSummary');
        const contentNode = node.content?.find((c: any) => c.type === 'detailsContent');
        
        const summaryRichText = summaryNode
          ? tiptapInlineToNotionRichText(summaryNode.content)
          : [];
        
        const level = summaryNode?.attrs?.level;
        const childrenBlocks = contentNode?.content
          ? tiptapToNotionBlocks(contentNode.content)
          : [];

        if (level === 1 || level === 2 || level === 3 || level === 4) {
          const mappedLevel = Math.min(level, 3);
          const blockType = `heading_${mappedLevel}`;
          
          const blockObj: any = {
            object: 'block',
            type: blockType,
            [blockType]: {
              rich_text: summaryRichText,
              is_toggleable: true
            }
          };

          if (childrenBlocks.length > 0) {
            blockObj[blockType].children = childrenBlocks;
          }

          blocks.push(blockObj);
        } else {
          const blockObj: any = {
            object: 'block',
            type: 'toggle',
            toggle: {
              rich_text: summaryRichText
            }
          };

          if (childrenBlocks.length > 0) {
            blockObj.toggle.children = childrenBlocks;
          }

          blocks.push(blockObj);
        }
        break;
      }
      case 'image': {
        if (node.attrs?.src) {
          blocks.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: {
                url: node.attrs.src
              }
            }
          });
        }
        break;
      }
      case 'table': {
        const rows = node.content || [];
        if (rows.length === 0) break;

        const tableRows: any[] = [];
        let hasColumnHeader = false;
        let hasRowHeader = false;
        let maxCols = 0;

        const firstRow = rows[0];
        if (firstRow && firstRow.content) {
          hasColumnHeader = firstRow.content.some((cell: any) => cell.type === 'tableHeader');
        }
        hasRowHeader = rows.slice(1).some((row: any) => row.content && row.content[0] && row.content[0].type === 'tableHeader');

        rows.forEach((rowNode: any, rowIndex: number) => {
          if (rowNode.type !== 'tableRow' || !rowNode.content) return;
          const cells = rowNode.content;
          maxCols = Math.max(maxCols, cells.length);

          const cellRichTexts: any[] = [];
          cells.forEach((cellNode: any, cellIndex: number) => {
            const cellInline = extractCellInlineContent(cellNode);
            cellRichTexts.push(tiptapInlineToNotionRichText(cellInline));
          });

          tableRows.push({
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: cellRichTexts
            }
          });
        });

        tableRows.forEach(rowBlock => {
          const cells = rowBlock.table_row.cells;
          while (cells.length < maxCols) {
            cells.push([]);
          }
        });

        if (tableRows.length > 0 && maxCols > 0) {
          blocks.push({
            object: 'block',
            type: 'table',
            table: {
              table_width: maxCols,
              has_column_header: hasColumnHeader,
              has_row_header: hasRowHeader,
              children: tableRows
            }
          });
        }
        break;
      }
      case 'horizontalRule': {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

async function fetchBlockChildrenRecursive(userId: string, blockId: string): Promise<any[]> {
  const children: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    let url = `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`;
    if (startCursor) {
      url += `&start_cursor=${startCursor}`;
    }

    const response = await fetchNotion(userId, url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error({ blockId, status: response.status }, 'Failed to fetch block children');
      throw new ApiError(response.status, errorData.message || 'Failed to fetch block children');
    }

    const data = await response.json() as { results: any[]; has_more: boolean; next_cursor: string | null };
    children.push(...data.results);

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  for (const child of children) {
    if (child.has_children) {
      child.children = await fetchBlockChildrenRecursive(userId, child.id);
    }
  }

  return children;
}

export async function getNotionPageBlockTree(userId: string, pageId: string): Promise<any[]> {
  const children: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    let url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
    if (startCursor) {
      url += `&start_cursor=${startCursor}`;
    }

    const response = await fetchNotion(userId, url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error({ pageId, status: response.status }, 'Failed to fetch Notion page block children');
      throw new ApiError(response.status, errorData.message || 'Failed to fetch Notion page block children');
    }

    const data = await response.json() as { results: any[]; has_more: boolean; next_cursor: string | null };
    children.push(...data.results);

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  for (const block of children) {
    if (block.has_children) {
      block.children = await fetchBlockChildrenRecursive(userId, block.id);
    }
  }

  return children;
}

export function notionBlocksToTiptap(blocks: any[]): any {
  if (!blocks || !Array.isArray(blocks)) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const content: any[] = [];
  
  const processBlocks = (nodeList: any[]): any[] => {
    const results: any[] = [];
    
    for (const block of nodeList) {
      const type = block.type;
      const blockData = block[type];
      if (!blockData) continue;

      switch (type) {
        case 'paragraph': {
          results.push({
            type: 'paragraph',
            content: notionRichTextToTiptapInline(blockData.rich_text)
          });
          break;
        }
        case 'heading_1':
        case 'heading_2':
        case 'heading_3': {
          const level = parseInt(type.split('_')[1], 10);
          const isToggle = !!blockData.is_toggleable;
          const richText = notionRichTextToTiptapInline(blockData.rich_text);

          if (isToggle) {
            results.push({
              type: 'details',
              content: [
                {
                  type: 'detailsSummary',
                  attrs: { level },
                  content: richText
                },
                {
                  type: 'detailsContent',
                  content: (() => {
                    const processed = block.children && block.children.length > 0
                      ? processBlocks(block.children)
                      : [];
                    return processed.length > 0 ? processed : [{ type: 'paragraph' }];
                  })()
                }
              ]
            });
          } else {
            results.push({
              type: 'heading',
              attrs: { level },
              content: richText
            });
          }
          break;
        }
        case 'toggle': {
          const richText = notionRichTextToTiptapInline(blockData.rich_text);
          results.push({
            type: 'details',
            content: [
              {
                type: 'detailsSummary',
                attrs: { level: null },
                content: richText
              },
              {
                type: 'detailsContent',
                content: (() => {
                  const processed = block.children && block.children.length > 0
                    ? processBlocks(block.children)
                    : [];
                  return processed.length > 0 ? processed : [{ type: 'paragraph' }];
                })()
              }
            ]
          });
          break;
        }
        case 'bulleted_list_item':
        case 'numbered_list_item': {
          const isBullet = type === 'bulleted_list_item';
          const listType = isBullet ? 'bulletList' : 'orderedList';
          
          const itemContent: any[] = [
            {
              type: 'paragraph',
              content: notionRichTextToTiptapInline(blockData.rich_text)
            }
          ];

          if (block.children && block.children.length > 0) {
            itemContent.push(...processBlocks(block.children));
          }

          const listItemNode = {
            type: 'listItem',
            content: itemContent
          };

          const lastResult = results[results.length - 1];
          if (lastResult && lastResult.type === listType) {
            lastResult.content.push(listItemNode);
          } else {
            results.push({
              type: listType,
              content: [listItemNode]
            });
          }
          break;
        }
        case 'to_do': {
          const checked = !!blockData.checked;
          const itemContent: any[] = [
            {
              type: 'paragraph',
              content: notionRichTextToTiptapInline(blockData.rich_text)
            }
          ];

          if (block.children && block.children.length > 0) {
            itemContent.push(...processBlocks(block.children));
          }

          const taskItemNode = {
            type: 'taskItem',
            attrs: { checked },
            content: itemContent
          };

          const lastResult = results[results.length - 1];
          if (lastResult && lastResult.type === 'taskList') {
            lastResult.content.push(taskItemNode);
          } else {
            results.push({
              type: 'taskList',
              content: [taskItemNode]
            });
          }
          break;
        }
        case 'quote': {
          results.push({
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: notionRichTextToTiptapInline(blockData.rich_text)
              }
            ]
          });
          break;
        }
        case 'code': {
          const codeText = notionRichTextToTiptapInline(blockData.rich_text).map((c: any) => c.text).join('') || '';
          const language = blockData.language || 'javascript';
          results.push({
            type: 'codeBlock',
            attrs: { language },
            content: [{ type: 'text', text: codeText }]
          });
          break;
        }
        case 'divider': {
          results.push({
            type: 'horizontalRule'
          });
          break;
        }
        case 'image': {
          const url = blockData.type === 'external' ? blockData.external?.url : blockData.file?.url;
          if (url) {
            results.push({
              type: 'image',
              attrs: { src: url }
            });
          }
          break;
        }
        case 'table': {
          const hasColumnHeader = !!blockData.has_column_header;
          const hasRowHeader = !!blockData.has_row_header;
          const tableWidth = blockData.table_width || 0;

          const rowNodes: any[] = [];
          if (block.children && block.children.length > 0) {
            let rowIndex = 0;
            for (const rowBlock of block.children) {
              if (rowBlock.type !== 'table_row') continue;
              const rowData = rowBlock.table_row;
              if (!rowData || !rowData.cells) continue;

              const cellNodes: any[] = [];
              let colIndex = 0;
              for (const cellRichText of rowData.cells) {
                const isHeader = (hasColumnHeader && rowIndex === 0) || (hasRowHeader && colIndex === 0);
                const cellType = isHeader ? 'tableHeader' : 'tableCell';
                
                cellNodes.push({
                  type: cellType,
                  attrs: { backgroundColor: null },
                  content: [
                    {
                      type: 'paragraph',
                      content: notionRichTextToTiptapInline(cellRichText)
                    }
                  ]
                });
                colIndex++;
              }

              while (cellNodes.length < tableWidth) {
                const isHeader = (hasColumnHeader && rowIndex === 0) || (hasRowHeader && cellNodes.length === 0);
                const cellType = isHeader ? 'tableHeader' : 'tableCell';
                cellNodes.push({
                  type: cellType,
                  attrs: { backgroundColor: null },
                  content: [{ type: 'paragraph' }]
                });
              }

              rowNodes.push({
                type: 'tableRow',
                content: cellNodes
              });
              rowIndex++;
            }
          }

          if (rowNodes.length > 0) {
            results.push({
              type: 'table',
              content: rowNodes
            });
          }
          break;
        }
        default:
          break;
      }
    }
    return results;
  };

  const docContent = processBlocks(blocks);
  return {
    type: 'doc',
    content: docContent.length > 0 ? docContent : [{ type: 'paragraph' }]
  };
}

function getBlockChildren(block: any): any[] | undefined {
  if (!block || !block.type) return undefined;
  const typeData = block[block.type];
  return typeData ? typeData.children : undefined;
}

function setBlockChildren(block: any, children: any[] | undefined): void {
  if (!block || !block.type) return;
  const typeData = block[block.type];
  if (typeData) {
    if (children === undefined) {
      delete typeData.children;
    } else {
      typeData.children = children;
    }
  }
}

function isSafeToNest(block: any): boolean {
  const children = getBlockChildren(block);
  if (!children || children.length === 0) return true;
  if (children.length > 100) return false;
  for (const child of children) {
    if (!isSafeToNest(child)) return false;
  }
  return true;
}

async function appendNotionBlocksInChunks(userId: string, pageId: string, blocks: any[]): Promise<void> {
  const CHUNK_SIZE = 100;
  
  // Clone blocks to avoid modifying caller's data
  const clonedBlocks = JSON.parse(JSON.stringify(blocks));

  for (let i = 0; i < clonedBlocks.length; i += CHUNK_SIZE) {
    const chunk = clonedBlocks.slice(i, i + CHUNK_SIZE);
    
    // For each block in the chunk, if it's not safe to nest, prune its children and keep a reference to them
    const pendingAppends: { parentIndex: number; children: any[] }[] = [];
    
    for (let j = 0; j < chunk.length; j++) {
      const block = chunk[j];
      if (!isSafeToNest(block)) {
        const children = getBlockChildren(block);
        if (children && children.length > 0) {
          if (block.type === 'table') {
            // Table must have at least one child (table_row) upon creation.
            const firstChild = children[0];
            const remaining = children.slice(1);
            setBlockChildren(block, [firstChild]);
            if (remaining.length > 0) {
              pendingAppends.push({ parentIndex: j, children: remaining });
            }
          } else {
            // Strip all children
            setBlockChildren(block, undefined);
            pendingAppends.push({ parentIndex: j, children: children });
          }
        }
      }
    }

    const appendResponse = await fetchNotion(userId, `https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: chunk
      })
    });

    if (!appendResponse.ok) {
      const errorData = await appendResponse.json().catch(() => ({}));
      log.error({ pageId, status: appendResponse.status, errorData }, 'Failed to append Notion blocks');
      throw new ApiError(appendResponse.status, errorData.message || 'Failed to append Notion blocks');
    }

    // Process pending appends recursively if any exist
    if (pendingAppends.length > 0) {
      const responseData = await appendResponse.json().catch(() => null);
      if (responseData && Array.isArray(responseData.results)) {
        for (const pending of pendingAppends) {
          const createdBlock = responseData.results[pending.parentIndex];
          if (createdBlock && createdBlock.id) {
            await appendNotionBlocksInChunks(userId, createdBlock.id, pending.children);
          } else {
            log.error({ pageId, parentIndex: pending.parentIndex }, 'Could not find created block ID for pending append');
          }
        }
      } else {
        log.error({ pageId }, 'Notion API response did not contain results array for chunk append');
      }
    }
  }
}

export async function updateNotionPageContent(userId: string, pageId: string, blocks: any[]): Promise<void> {
  const getChildrenResponse = await fetchNotion(userId, `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`);
  if (getChildrenResponse.ok) {
    const data = await getChildrenResponse.json() as { results: any[] };
    for (const block of data.results) {
      await fetchNotion(userId, `https://api.notion.com/v1/blocks/${block.id}`, {
        method: 'DELETE'
      });
    }
  }

  if (blocks.length > 0) {
    await appendNotionBlocksInChunks(userId, pageId, blocks);
  }
}

/**
 * Fetch a Notion page details (properties, title, icon, cover)
 */
export async function getNotionPage(userId: string, pageId: string): Promise<any> {
  const response = await fetchNotion(userId, `https://api.notion.com/v1/pages/${pageId}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ pageId, status: response.status }, 'Failed to fetch Notion page');
    throw new ApiError(response.status, errorData.message || 'Failed to fetch Notion page');
  }
  
  return response.json();
}

/**
 * Update Notion Page Properties (Title, Icon, Cover)
 */
export async function updateNotionPageProperties(
  userId: string, 
  pageId: string, 
  title?: string, 
  icon?: string | null, 
  coverImage?: string | null
): Promise<void> {
  const properties: Record<string, any> = {};
  if (title !== undefined) {
    properties.title = {
      title: [{ text: { content: title } }]
    };
  }
  
  let iconPayload: any = undefined;
  if (icon !== undefined) {
    if (!icon) {
      iconPayload = null;
    } else if (icon.startsWith('lucide:') || icon.startsWith('data:image')) {
      // Custom images or Lucide icons map to external images
      iconPayload = { type: 'external', external: { url: icon } };
    } else {
      // Emojis
      iconPayload = { type: 'emoji', emoji: icon };
    }
  }
  
  let coverPayload: any = undefined;
  if (coverImage !== undefined) {
    coverPayload = coverImage ? { type: 'external', external: { url: coverImage } } : null;
  }
  
  const body: any = {};
  if (Object.keys(properties).length > 0) body.properties = properties;
  if (iconPayload !== undefined) body.icon = iconPayload;
  if (coverPayload !== undefined) body.cover = coverPayload;
  
  if (Object.keys(body).length === 0) return;
  
  const response = await fetchNotion(userId, `https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ pageId, status: response.status }, 'Failed to update Notion page properties');
    throw new ApiError(response.status, errorData.message || 'Failed to update Notion page properties');
  }
}

/**
 * Create a new page in Notion.
 * Creating is typically under a database or a parent page.
 */
export async function createNotionPage(
  userId: string,
  parentId: string,
  parentType: 'page' | 'database',
  title: string,
  blocks?: any[]
): Promise<{ id: string }> {
  const body: any = {
    parent: {
      type: parentType === 'database' ? 'database_id' : 'page_id',
      [parentType === 'database' ? 'database_id' : 'page_id']: parentId,
    },
    properties: {
      title: {
        title: [
          {
            text: {
              content: title,
            },
          },
        ],
      },
    },
  };

  const initialBlocks = blocks ? blocks.slice(0, 100) : [];
  const remainingBlocks = blocks ? blocks.slice(100) : [];

  if (initialBlocks.length > 0) {
    body.children = initialBlocks;
  }

  const response = await fetchNotion(userId, 'https://api.notion.com/v1/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ status: response.status, errorData }, 'Failed to create Notion page');
    throw new ApiError(response.status, errorData.message || 'Failed to create Notion page');
  }

  const createdPage = await response.json() as { id: string };

  if (remainingBlocks.length > 0) {
    await appendNotionBlocksInChunks(userId, createdPage.id, remainingBlocks);
  }

  return createdPage;
}

// ─── Bidirectional Sync / Operations ─────────────────────────────────────────────

/**
 * Import a Notion page to Motion
 */
export async function importNotionPage(
  userId: string,
  notionPageId: string,
  orgId: string,
  spaceId: string,
  parentId?: string | null
): Promise<any> {
  log.info({ userId, notionPageId, spaceId }, 'Importing Notion page');
  
  // 1. Fetch Notion page metadata & block tree
  const pageMeta = await getNotionPage(userId, notionPageId);
  const blockTree = await getNotionPageBlockTree(userId, notionPageId);
  
  // 2. Parse title
  let title = 'Untitled';
  if (pageMeta.properties) {
    // Look for first title-type property (usually named "title" or "Name")
    const titleKey = Object.keys(pageMeta.properties).find(
      key => pageMeta.properties[key].type === 'title'
    );
    if (titleKey && pageMeta.properties[titleKey].title?.[0]) {
      title = pageMeta.properties[titleKey].title[0].plain_text || 'Untitled';
    }
  }
  
  // 3. Map icon
  let icon: string | null = null;
  if (pageMeta.icon) {
    if (pageMeta.icon.type === 'emoji') {
      icon = pageMeta.icon.emoji;
    } else if (pageMeta.icon.type === 'external') {
      icon = pageMeta.icon.external.url;
    } else if (pageMeta.icon.type === 'file') {
      icon = pageMeta.icon.file.url;
    }
  }
  
  // 4. Map cover
  let coverImage: string | null = null;
  if (pageMeta.cover) {
    coverImage = pageMeta.cover.type === 'external' ? pageMeta.cover.external.url : pageMeta.cover.file?.url;
  }
  
  // 5. Convert blocks to TipTap JSONContent
  const tiptapContent = notionBlocksToTiptap(blockTree);
  
  // 6. Append position
  const maxPos = await motionPageRepository.getMaxPosition(orgId, spaceId, parentId ?? null);
  
  // 7. Create local Motion page
  const newPage = await motionPageRepository.create({
    org_id: orgId,
    space_id: spaceId,
    created_by: userId,
    updated_by: userId,
    parent_id: parentId ?? null,
    title,
    content: tiptapContent,
    icon,
    cover_image: coverImage,
    position: maxPos + 1000,
    small_text: false,
    full_width: false,
    notion_page_id: notionPageId,
    notion_last_synced_at: new Date(),
  });
  
  return newPage;
}

/**
 * Export a Motion page to Notion
 */
async function findFirstAvailableParentPage(userId: string): Promise<string> {
  const response = await fetchNotion(userId, 'https://api.notion.com/v1/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'object',
        value: 'page',
      },
      page_size: 5,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ status: response.status, errorData }, 'Failed to search Notion pages for default parent');
    throw new ApiError(response.status, errorData.message || 'Failed to search Notion pages');
  }

  const searchData = (await response.json()) as { results: any[] };
  if (!searchData.results || searchData.results.length === 0) {
    // Try searching databases if no pages are found
    const dbResponse = await fetchNotion(userId, 'https://api.notion.com/v1/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'database',
        },
        page_size: 5,
      }),
    });
    if (dbResponse.ok) {
      const dbSearchData = (await dbResponse.json()) as { results: any[] };
      if (dbSearchData.results && dbSearchData.results.length > 0) {
        return dbSearchData.results[0].id;
      }
    }
    throw new ApiError(
      400,
      'No pages or databases shared with the integration. Please share at least one Notion page/database with your integration.'
    );
  }

  return searchData.results[0].id;
}

export async function exportMotionPage(
  userId: string,
  motionPageId: string,
  parentNotionPageId?: string | null,
  targetNotionPageId?: string | null,
  mode: 'create' | 'append' = 'create'
): Promise<any> {
  log.info({ userId, motionPageId, mode }, 'Exporting Motion page to Notion');

  // 1. Fetch local page
  const page = await motionPageRepository.findById(motionPageId);
  if (!page) {
    throw new ApiError(404, 'Motion page not found');
  }

  // 2. Format to notion blocks directly
  const blocks = tiptapToNotionBlocks(page.content?.content || []);

  // 3. Get connection and default workspaces
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration || !integration.access_token) {
    throw new ApiError(401, 'Notion is not connected');
  }

  let notionPageId = targetNotionPageId;

  if (mode === 'create' || !notionPageId) {
    // Determine parent page ID
    let targetParentId = parentNotionPageId;
    if (!targetParentId && page.parent_id) {
      const parentPage = await motionPageRepository.findById(page.parent_id);
      if (parentPage?.notion_page_id) {
        targetParentId = parentPage.notion_page_id;
      }
    }

    // Auto-discover parent if not specified
    if (!targetParentId) {
      targetParentId = await findFirstAvailableParentPage(userId);
    }

    // Create a new Notion page under the parent page/database
    const notionPage = await createNotionPage(userId, targetParentId, 'page', page.title, blocks);
    notionPageId = notionPage.id;
  } else {
    // Append/overwrite existing page
    await updateNotionPageContent(userId, notionPageId, blocks);
  }

  // Update properties (title, icon & cover)
  await updateNotionPageProperties(userId, notionPageId, page.title, page.icon, page.cover_image);

  // Link in local DB
  const updated = await motionPageRepository.update(motionPageId, {
    notion_page_id: notionPageId,
    notion_last_synced_at: new Date(),
  });

  return updated;
}

/**
 * Perform manual/automatic Bidirectional 2-Way Sync between Notion and Motion
 */
export async function syncNotionAndMotion(userId: string, motionPageId: string): Promise<any> {
  log.info({ motionPageId }, 'Syncing Motion Page with Notion');
  
  // 1. Fetch local page
  const localPage = await motionPageRepository.findById(motionPageId);
  if (!localPage) {
    throw new ApiError(404, 'Motion page not found');
  }
  
  const notionPageId = localPage.notion_page_id;
  if (!notionPageId) {
    throw new ApiError(400, 'Page is not linked to Notion. Please export or link it first.');
  }
  
  // 2. Fetch Notion page meta & content
  const notionMeta = await getNotionPage(userId, notionPageId);
  const blockTree = await getNotionPageBlockTree(userId, notionPageId);
  
  const notionLastEdited = new Date(notionMeta.last_edited_time);
  const localLastEdited = new Date(localPage.updated_at);
  const lastSynced = localPage.notion_last_synced_at ? new Date(localPage.notion_last_synced_at) : new Date(0);
  
  // Check who has newer updates since last sync
  const hasLocalChanges = localLastEdited.getTime() > lastSynced.getTime() + 1000; // 1s buffer
  const hasNotionChanges = notionLastEdited.getTime() > lastSynced.getTime() + 1000;
  
  // 3. Resolve sync direction (Last-Write-Wins logic)
  if (hasLocalChanges && hasNotionChanges) {
    // Conflict: resolve by comparing last write timestamps
    if (localLastEdited.getTime() >= localLastEdited.getTime()) {
      log.info({ motionPageId }, 'Sync Conflict: Local changes are newer. Syncing Local -> Notion.');
      await syncLocalToNotion(userId, localPage, notionPageId);
    } else {
      log.info({ motionPageId }, 'Sync Conflict: Notion changes are newer. Syncing Notion -> Local.');
      return syncNotionToLocal(userId, localPage, notionMeta, blockTree);
    }
  } else if (hasLocalChanges) {
    log.info({ motionPageId }, 'Sync: Syncing Local -> Notion.');
    await syncLocalToNotion(userId, localPage, notionPageId);
  } else if (hasNotionChanges) {
    log.info({ motionPageId }, 'Sync: Syncing Notion -> Local.');
    return syncNotionToLocal(userId, localPage, notionMeta, blockTree);
  } else {
    log.info({ motionPageId }, 'Sync: Both sides already in-sync.');
  }
  
  // Update last synced timestamp in DB
  const finalUpdated = await motionPageRepository.update(motionPageId, {
    notion_last_synced_at: new Date(),
  });
  
  return finalUpdated;
}

// ─── Sync Directions Helpers ─────────────────────────────────────────────────────

async function syncLocalToNotion(userId: string, localPage: any, notionPageId: string): Promise<void> {
  const blocks = tiptapToNotionBlocks(localPage.content?.content || []);
  // Update content
  await updateNotionPageContent(userId, notionPageId, blocks);
  // Update properties (Title, Icon, Cover)
  await updateNotionPageProperties(userId, notionPageId, localPage.title, localPage.icon, localPage.cover_image);
}

async function syncNotionToLocal(userId: string, localPage: any, notionMeta: any, blockTree: any[]): Promise<any> {
  // Parse Notion title
  let title = localPage.title;
  if (notionMeta.properties) {
    const titleKey = Object.keys(notionMeta.properties).find(
      key => notionMeta.properties[key].type === 'title'
    );
    if (titleKey && notionMeta.properties[titleKey].title?.[0]) {
      title = notionMeta.properties[titleKey].title[0].plain_text || localPage.title;
    }
  }
  
  // Parse Notion icon
  let icon: string | null = localPage.icon;
  if (notionMeta.icon) {
    if (notionMeta.icon.type === 'emoji') {
      icon = notionMeta.icon.emoji;
    } else if (notionMeta.icon.type === 'external') {
      icon = notionMeta.icon.external.url;
    } else if (notionMeta.icon.type === 'file') {
      icon = notionMeta.icon.file.url;
    }
  } else {
    icon = null;
  }
  
  // Parse Notion cover
  let coverImage: string | null = null;
  if (notionMeta.cover) {
    coverImage = notionMeta.cover.type === 'external' ? notionMeta.cover.external.url : notionMeta.cover.file?.url;
  }
  
  // Parse Notion content
  const tiptapContent = notionBlocksToTiptap(blockTree);
  
  // Update local DB page (using skipSync flags or let update handle it silently)
  const updatedPage = await motionPageRepository.update(localPage.id, {
    title,
    icon,
    cover_image: coverImage,
    content: tiptapContent,
    notion_last_synced_at: new Date(),
  });
  
  return updatedPage;
}

/**
 * Search Notion pages shared with the integration.
 */
export async function searchNotion(
  userId: string,
  query?: string,
  startCursor?: string,
  pageSize = 50
): Promise<any> {
  const body: any = {
    filter: {
      property: 'object',
      value: 'page',
    },
    page_size: Math.min(pageSize, 100),
  };

  if (query) {
    body.query = query;
  }
  if (startCursor) {
    body.start_cursor = startCursor;
  }

  const response = await fetchNotion(userId, 'https://api.notion.com/v1/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ status: response.status, errorData }, 'Failed to search Notion workspace');
    throw new ApiError(response.status, errorData.message || 'Failed to search Notion pages');
  }

  return response.json();
}

