import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { MotionPage, MotionPageShare } from '../types/entities';

export class MotionPageRepository extends BaseRepository<MotionPage> {
  constructor() {
    super('motion_pages');
  }

  /**
   * Returns all active (non-deleted) pages for a space, ordered for sidebar
   * tree rendering: root pages first (parent_id IS NULL), then by position ASC.
   * Includes soft-deleted pages only when includeDeleted = true (for trash view).
   */
  async findBySpace(
    orgId: string,
    spaceId: string,
    includeDeleted = false,
    client?: PoolClient,
  ): Promise<MotionPage[]> {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const query = `
      SELECT *
      FROM public.motion_pages
      WHERE org_id = $1
        AND space_id = $2
        ${deletedClause}
      ORDER BY
        parent_id NULLS FIRST,
        position ASC,
        created_at ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId]);
    return result.rows as MotionPage[];
  }

  /**
   * Returns all active (non-deleted) pages for a space without the massive content column.
   * Used for the sidebar tree rendering.
   */
  async findBySpaceLite(
    orgId: string,
    spaceId: string,
    includeDeleted = false,
    client?: PoolClient,
  ): Promise<Omit<MotionPage, 'content'>[]> {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const query = `
      SELECT id, org_id, space_id, created_by, updated_by, parent_id, title, icon, cover_image, cover_position, position, small_text, full_width, created_at, updated_at, deleted_at, notion_page_id, notion_last_synced_at
      FROM public.motion_pages
      WHERE org_id = $1
        AND space_id = $2
        ${deletedClause}
      ORDER BY
        parent_id NULLS FIRST,
        position ASC,
        created_at ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId]);
    return result.rows as Omit<MotionPage, 'content'>[];
  }

  /**
   * Returns only soft-deleted pages for a space (trash view).
   */
  async findTrashBySpace(
    orgId: string,
    spaceId: string,
    client?: PoolClient,
  ): Promise<MotionPage[]> {
    const query = `
      SELECT *
      FROM public.motion_pages
      WHERE org_id = $1
        AND space_id = $2
        AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [orgId, spaceId]);
    return result.rows as MotionPage[];
  }

  /**
   * Finds a single active page by id, validating it belongs to the given org+space.
   * Returns null if not found, deleted, or org/space mismatch.
   */
  async findByIdInSpace(
    id: string,
    orgId: string,
    spaceId: string,
    client?: PoolClient,
  ): Promise<MotionPage | null> {
    const query = `
      SELECT *
      FROM public.motion_pages
      WHERE id = $1
        AND org_id = $2
        AND space_id = $3
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [id, orgId, spaceId]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPage) : null;
  }

  /**
   * Returns the maximum position value among siblings (same parent_id) in a space.
   * Used to append a new page at the end of a sibling group.
   */
  async getMaxPosition(
    orgId: string,
    spaceId: string,
    parentId: string | null,
    client?: PoolClient,
  ): Promise<number> {
    const query = parentId
      ? `SELECT COALESCE(MAX(position), 0) as max_pos
         FROM public.motion_pages
         WHERE org_id = $1 AND space_id = $2 AND parent_id = $3 AND deleted_at IS NULL`
      : `SELECT COALESCE(MAX(position), 0) as max_pos
         FROM public.motion_pages
         WHERE org_id = $1 AND space_id = $2 AND parent_id IS NULL AND deleted_at IS NULL`;

    const params = parentId ? [orgId, spaceId, parentId] : [orgId, spaceId];
    const executor = client || this.pool;
    const result = await executor.query(query, params);
    return parseFloat(result.rows[0].max_pos) || 0;
  }

  /**
   * Hard-deletes a page row. The DB CASCADE on parent_id will recursively
   * hard-delete all subpages. Only call this for permanent deletion.
   */
  async hardDelete(id: string, client?: PoolClient): Promise<void> {
    const query = `DELETE FROM public.motion_pages WHERE id = $1`;
    const executor = client || this.pool;
    await executor.query(query, [id]);
  }

  /**
   * Soft-deletes a page AND all its descendants recursively using a CTE.
   * This is the correct behaviour: trashing a parent trashes the whole subtree.
   */
  async softDeleteWithDescendants(id: string, client?: PoolClient): Promise<void> {
    const query = `
      WITH RECURSIVE subtree AS (
        -- Anchor: the page being deleted
        SELECT id FROM public.motion_pages WHERE id = $1
        UNION ALL
        -- Recursive: all children of pages already in the set
        SELECT mp.id
        FROM public.motion_pages mp
        INNER JOIN subtree s ON mp.parent_id = s.id
        WHERE mp.deleted_at IS NULL
      )
      UPDATE public.motion_pages
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id IN (SELECT id FROM subtree)
        AND deleted_at IS NULL
    `;
    const executor = client || this.pool;
    await executor.query(query, [id]);
  }

  /**
   * Soft-deletes a page (moves to trash). Does NOT cascade to subpages.
   * Kept for internal use; prefer softDeleteWithDescendants from the service layer.
   */
  async softDelete(id: string, client?: PoolClient): Promise<MotionPage | null> {
    const query = `
      UPDATE public.motion_pages
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [id]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPage) : null;
  }

  /**
   * Restores a soft-deleted page from trash.
   */
  async restore(id: string, client?: PoolClient): Promise<MotionPage | null> {
    const query = `
      UPDATE public.motion_pages
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NOT NULL
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [id]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPage) : null;
  }
}

// ─── Share Repository ─────────────────────────────────────────────────────────

export class MotionPageShareRepository extends BaseRepository<MotionPageShare> {
  constructor() {
    super('motion_page_shares');
  }

  /**
   * Finds a single share by its ID.
   * Overrides base findById because motion_page_shares has no deleted_at column.
   */
  async findById(id: string, client?: PoolClient): Promise<MotionPageShare | null> {
    const query = `
      SELECT *
      FROM public.motion_page_shares
      WHERE id = $1
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [id]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPageShare) : null;
  }

  /**
   * Finds a single share by its ID with target details joined.
   */
  async findByIdWithDetails(id: string, client?: PoolClient): Promise<any | null> {
    const query = `
      SELECT 
        mps.*,
        o.name as target_org_name,
        o.is_personal as target_org_is_personal,
        s.name as target_space_name,
        u.email as target_user_email,
        u.name as target_user_name,
        u.avatar_url as target_user_avatar
      FROM public.motion_page_shares mps
      LEFT JOIN public.organisations o ON o.id = mps.target_org_id
      LEFT JOIN public.spaces s ON s.id = mps.target_space_id
      LEFT JOIN public.users u ON u.id = o.owner_user_id AND o.is_personal = TRUE
      WHERE mps.id = $1
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findByPage(pageId: string, client?: PoolClient): Promise<any[]> {
    const query = `
      SELECT 
        mps.*,
        o.name as target_org_name,
        o.is_personal as target_org_is_personal,
        s.name as target_space_name,
        u.email as target_user_email,
        u.name as target_user_name,
        u.avatar_url as target_user_avatar
      FROM public.motion_page_shares mps
      LEFT JOIN public.organisations o ON o.id = mps.target_org_id
      LEFT JOIN public.spaces s ON s.id = mps.target_space_id
      LEFT JOIN public.users u ON u.id = o.owner_user_id AND o.is_personal = TRUE
      WHERE mps.page_id = $1
      ORDER BY mps.created_at ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId]);
    return result.rows;
  }

  /**
   * Resolves a public link token to its share record.
   * Returns null if the token doesn't exist or has expired.
   */
  async findByToken(token: string, client?: PoolClient): Promise<MotionPageShare | null> {
    const query = `
      SELECT *
      FROM public.motion_page_shares
      WHERE share_token = $1
        AND share_type = 'public_link'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [token]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPageShare) : null;
  }

  /**
   * Returns all pages shared INTO a given space (cross-space shares).
   * Joins motion_pages to return the full page data.
   */
  /**
   * Returns all pages shared INTO a given space (cross-space shares).
   * Joins motion_pages to return the full page data, recursively resolving subpages.
   */
  async findPagesSharedToSpace(
    targetOrgId: string,
    targetSpaceId: string,
    client?: PoolClient,
  ): Promise<MotionPage[]> {
    const query = `
      WITH RECURSIVE shared_roots AS (
        SELECT 
          mp.id, 
          mp.org_id, 
          mp.space_id, 
          mp.created_by, 
          mp.updated_by, 
          mp.parent_id, 
          mp.title, 
          mp.content, 
          mp.icon, 
          mp.cover_image, 
          mp.cover_position, 
          mp.position, 
          mp.small_text, 
          mp.full_width, 
          mp.created_at, 
          mp.updated_at, 
          mp.deleted_at, 
          mp.notion_page_id, 
          mp.notion_last_synced_at,
          mps.permission as share_permission,
          mps.created_by as shared_by_user_id,
          mps.created_at as shared_at,
          u.name as sharer_name,
          u.avatar_url as sharer_avatar_url,
          u.email as sharer_email
        FROM public.motion_page_shares mps
        INNER JOIN public.motion_pages mp ON mp.id = mps.page_id
        LEFT JOIN public.users u ON u.id = mps.created_by
        WHERE mps.target_org_id = $1
          AND mps.target_space_id = $2
          AND mps.share_type = 'space'
          AND (mps.expires_at IS NULL OR mps.expires_at > NOW())
          AND mp.deleted_at IS NULL
        
        UNION ALL
        
        SELECT 
          child.id, 
          child.org_id, 
          child.space_id, 
          child.created_by, 
          child.updated_by, 
          child.parent_id, 
          child.title, 
          child.content, 
          child.icon, 
          child.cover_image, 
          child.cover_position, 
          child.position, 
          child.small_text, 
          child.full_width, 
          child.created_at, 
          child.updated_at, 
          child.deleted_at, 
          child.notion_page_id, 
          child.notion_last_synced_at,
          parent.share_permission,
          parent.shared_by_user_id,
          parent.shared_at,
          parent.sharer_name,
          parent.sharer_avatar_url,
          parent.sharer_email
        FROM public.motion_pages child
        INNER JOIN shared_roots parent ON child.parent_id = parent.id
        WHERE child.deleted_at IS NULL
      )
      SELECT * FROM shared_roots
      ORDER BY updated_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [targetOrgId, targetSpaceId]);
    return result.rows as MotionPage[];
  }

  /**
   * Finds a single page that has been shared INTO a given space, recursively resolving parent page sharing.
   */
  async findByIdSharedToSpace(
    pageId: string,
    targetOrgId: string,
    targetSpaceId: string,
    client?: PoolClient,
  ): Promise<MotionPage | null> {
    const query = `
      WITH RECURSIVE page_ancestors AS (
        SELECT id, parent_id, org_id, space_id, title, content, icon, cover_image, cover_position, position, small_text, full_width, created_by, updated_by, notion_page_id, notion_last_synced_at, created_at, updated_at, deleted_at,
               id as original_page_id
        FROM public.motion_pages
        WHERE id = $1 AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT mp.id, mp.parent_id, mp.org_id, mp.space_id, mp.title, mp.content, mp.icon, mp.cover_image, mp.cover_position, mp.position, mp.small_text, mp.full_width, mp.created_by, mp.updated_by, mp.notion_page_id, mp.notion_last_synced_at, mp.created_at, mp.updated_at, mp.deleted_at,
               pa.original_page_id
        FROM public.motion_pages mp
        INNER JOIN page_ancestors pa ON pa.parent_id = mp.id
        WHERE mp.deleted_at IS NULL
      )
      SELECT 
        mp.id, 
        mp.org_id, 
        mp.space_id, 
        mp.created_by, 
        mp.updated_by, 
        mp.parent_id, 
        mp.title, 
        mp.content, 
        mp.icon, 
        mp.cover_image, 
        mp.cover_position, 
        mp.position, 
        mp.small_text, 
        mp.full_width, 
        mp.created_at, 
        mp.updated_at, 
        mp.deleted_at, 
        mp.notion_page_id, 
        mp.notion_last_synced_at,
        mps.permission as share_permission,
        mps.created_by as shared_by_user_id,
        mps.created_at as shared_at,
        u.name as sharer_name,
        u.avatar_url as sharer_avatar_url,
        u.email as sharer_email
      FROM page_ancestors pa
      INNER JOIN public.motion_pages mp ON mp.id = pa.original_page_id
      INNER JOIN public.motion_page_shares mps ON mps.page_id = pa.id
      LEFT JOIN public.users u ON u.id = mps.created_by
      WHERE mps.target_org_id = $2
        AND mps.target_space_id = $3
        AND mps.share_type = 'space'
        AND (mps.expires_at IS NULL OR mps.expires_at > NOW())
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, targetOrgId, targetSpaceId]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPage) : null;
  }

  /**
   * Finds if a page or any of its ancestors has an active public link share.
   */
  async findPublicShareForPageAndAncestors(
    pageId: string,
    client?: PoolClient,
  ): Promise<MotionPageShare | null> {
    const query = `
      WITH RECURSIVE page_ancestors AS (
        SELECT id, parent_id, deleted_at
        FROM public.motion_pages
        WHERE id = $1 AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT mp.id, mp.parent_id, mp.deleted_at
        FROM public.motion_pages mp
        INNER JOIN page_ancestors pa ON pa.parent_id = mp.id
        WHERE mp.deleted_at IS NULL
      )
      SELECT mps.*
      FROM page_ancestors pa
      INNER JOIN public.motion_page_shares mps ON mps.page_id = pa.id
      WHERE mps.share_type = 'public_link'
        AND (mps.expires_at IS NULL OR mps.expires_at > NOW())
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPageShare) : null;
  }

  /**
   * Finds an existing space share for a page+target combination.
   * Used to prevent duplicate space shares.
   */
  async findSpaceShare(
    pageId: string,
    targetOrgId: string,
    targetSpaceId: string,
    client?: PoolClient,
  ): Promise<MotionPageShare | null> {
    const query = `
      SELECT *
      FROM public.motion_page_shares
      WHERE page_id = $1
        AND target_org_id = $2
        AND target_space_id = $3
        AND share_type = 'space'
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, targetOrgId, targetSpaceId]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPageShare) : null;
  }

  /**
   * Updates a share record by ID.
   * Overrides BaseRepository.update() because motion_page_shares has NO
   * deleted_at column — the base method's "AND deleted_at IS NULL" clause
   * would match zero rows and silently return null.
   */
  async update(
    id: string,
    data: Partial<MotionPageShare>,
    client?: PoolClient,
  ): Promise<MotionPageShare | null> {
    const validData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );
    const keys = Object.keys(validData);
    const values = Object.values(validData);

    if (keys.length === 0) {
      return this.findById(id, client);
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');

    const query = `
      UPDATE public.motion_page_shares
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const executor = client || this.pool;
    const result = await executor.query(query, [id, ...values]);
    return result.rows.length > 0 ? (result.rows[0] as MotionPageShare) : null;
  }
}
