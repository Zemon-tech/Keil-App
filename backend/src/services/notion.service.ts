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

  const flushList = () => {
    if (currentList) {
      content.push({
        type: currentList.type,
        content: currentList.items,
      });
      currentList = null;
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
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
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
      content.push({
        type: 'image',
        attrs: { src: imageMatch[2] },
      });
      continue;
    }

    if (line.trim() === '---') {
      flushList();
      content.push({
        type: 'horizontalRule',
      });
      continue;
    }

    flushList();
    content.push({
      type: 'paragraph',
      content: parseInline(line),
    });
  }

  flushList();

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
 * Fetch a Notion page content as Markdown
 */
export async function getNotionPageMarkdown(userId: string, pageId: string): Promise<string> {
  const response = await fetchNotion(userId, `https://api.notion.com/v1/pages/${pageId}/markdown`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ pageId, status: response.status }, 'Failed to fetch Notion page markdown');
    throw new ApiError(response.status, errorData.message || 'Failed to fetch Notion page markdown');
  }
  
  const data = await response.json() as { page_markdown: string };
  return data.page_markdown || '';
}

/**
 * Replace the content of a Notion page with a markdown string
 */
export async function updateNotionPageMarkdown(userId: string, pageId: string, markdown: string): Promise<void> {
  const response = await fetchNotion(userId, `https://api.notion.com/v1/pages/${pageId}/markdown`, {
    method: 'PATCH',
    body: JSON.stringify({
      command: 'replace_content',
      markdown
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ pageId, status: response.status, errorData }, 'Failed to update Notion page markdown');
    throw new ApiError(response.status, errorData.message || 'Failed to update Notion page markdown');
  }
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
  markdownContent?: string
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

  if (markdownContent) {
    body.markdown = markdownContent;
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

  return response.json();
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
  
  // 1. Fetch Notion page metadata & markdown
  const pageMeta = await getNotionPage(userId, notionPageId);
  const markdown = await getNotionPageMarkdown(userId, notionPageId);
  
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
  
  // 5. Convert markdown to TipTap JSONContent
  const tiptapContent = markdownToTiptap(markdown);
  
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

  // 2. Format to markdown
  const markdown = tiptapToMarkdown(page.content);

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
    const notionPage = await createNotionPage(userId, targetParentId, 'page', page.title, markdown);
    notionPageId = notionPage.id;
  } else {
    // Append/overwrite existing page
    await updateNotionPageMarkdown(userId, notionPageId, markdown);
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
  const notionMarkdown = await getNotionPageMarkdown(userId, notionPageId);
  
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
      return syncNotionToLocal(userId, localPage, notionMeta, notionMarkdown);
    }
  } else if (hasLocalChanges) {
    log.info({ motionPageId }, 'Sync: Syncing Local -> Notion.');
    await syncLocalToNotion(userId, localPage, notionPageId);
  } else if (hasNotionChanges) {
    log.info({ motionPageId }, 'Sync: Syncing Notion -> Local.');
    return syncNotionToLocal(userId, localPage, notionMeta, notionMarkdown);
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
  const markdown = tiptapToMarkdown(localPage.content);
  // Update content
  await updateNotionPageMarkdown(userId, notionPageId, markdown);
  // Update properties (Title, Icon, Cover)
  await updateNotionPageProperties(userId, notionPageId, localPage.title, localPage.icon, localPage.cover_image);
}

async function syncNotionToLocal(userId: string, localPage: any, notionMeta: any, notionMarkdown: string): Promise<any> {
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
  const tiptapContent = markdownToTiptap(notionMarkdown);
  
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
