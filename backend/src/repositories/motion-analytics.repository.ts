import { PoolClient } from "pg";
import { BaseRepository } from "./base.repository";
import { User } from "../types/entities";

export interface MotionPageUpdate {
  id: string;
  page_id: string;
  user_id: string | null;
  action_type: string;
  description: string | null;
  before_title: string | null;
  before_content: any | null;
  deleted_content: string[] | null;
  added_content: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface MotionPageView {
  id: string;
  page_id: string;
  user_id: string | null;
  created_at: Date;
}

export interface MotionPageViewPermission {
  page_id: string;
  user_id: string;
  allow_view_history: boolean;
}

export class MotionAnalyticsRepository extends BaseRepository<any> {
  constructor() {
    super("motion_page_updates"); // Primary table we log in this domain
  }

  // ─── 1. Page Views ─────────────────────────────────────────────────────────

  async recordView(
    pageId: string,
    userId: string | null,
    client?: PoolClient
  ): Promise<MotionPageView> {
    const query = `
      INSERT INTO public.motion_page_views (page_id, user_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, userId]);
    return result.rows[0] as MotionPageView;
  }

  async getViewsSummary(
    pageId: string,
    daysRange: number,
    client?: PoolClient
  ): Promise<{ date: string; views: number; unique_views: number }[]> {
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - ($2 - 1) * INTERVAL '1 day',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date_val
      ),
      view_counts AS (
        SELECT 
          created_at::date AS view_date,
          COUNT(*) AS total_views,
          COUNT(DISTINCT COALESCE(user_id::text, gen_random_uuid()::text)) AS unique_views
        FROM public.motion_page_views
        WHERE page_id = $1
          AND created_at >= CURRENT_DATE - ($2 - 1) * INTERVAL '1 day'
        GROUP BY created_at::date
      )
      SELECT 
        ds.date_val AS date,
        COALESCE(vc.total_views, 0)::integer AS views,
        COALESCE(vc.unique_views, 0)::integer AS unique_views
      FROM date_series ds
      LEFT JOIN view_counts vc ON ds.date_val = vc.view_date
      ORDER BY ds.date_val ASC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, daysRange]);
    return result.rows;
  }

  // ─── 2. View History Opt-In Permissions ─────────────────────────────────────

  async setViewPermission(
    pageId: string,
    userId: string,
    allow: boolean,
    client?: PoolClient
  ): Promise<MotionPageViewPermission> {
    const query = `
      INSERT INTO public.motion_page_view_permissions (page_id, user_id, allow_view_history)
      VALUES ($1, $2, $3)
      ON CONFLICT (page_id, user_id) 
      DO UPDATE SET allow_view_history = EXCLUDED.allow_view_history
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, userId, allow]);
    return result.rows[0] as MotionPageViewPermission;
  }

  async getViewPermission(
    pageId: string,
    userId: string,
    client?: PoolClient
  ): Promise<MotionPageViewPermission | null> {
    const query = `
      SELECT *
      FROM public.motion_page_view_permissions
      WHERE page_id = $1 AND user_id = $2
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, userId]);
    return result.rows.length > 0 ? result.rows[0] as MotionPageViewPermission : null;
  }

  async getViewers(
    pageId: string,
    client?: PoolClient
  ): Promise<(User & { last_viewed_at: Date })[]> {
    const query = `
      SELECT DISTINCT ON (v.user_id)
        u.id,
        u.email,
        u.name,
        v.created_at AS last_viewed_at
      FROM public.motion_page_views v
      INNER JOIN public.users u ON v.user_id = u.id
      INNER JOIN public.motion_page_view_permissions p ON p.page_id = v.page_id AND p.user_id = v.user_id
      WHERE v.page_id = $1
        AND p.allow_view_history = TRUE
      ORDER BY v.user_id, v.created_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId]);
    
    // Resort by last_viewed_at DESC
    return (result.rows as any[]).sort((a, b) => 
      new Date(b.last_viewed_at).getTime() - new Date(a.last_viewed_at).getTime()
    );
  }

  // ─── 3. Page Updates and Grouped Sessions ───────────────────────────────────

  async findRecentUpdateSession(
    pageId: string,
    userId: string,
    client?: PoolClient
  ): Promise<MotionPageUpdate | null> {
    const query = `
      SELECT *
      FROM public.motion_page_updates
      WHERE page_id = $1
        AND user_id = $2
        AND action_type = 'edit'
        AND updated_at >= NOW() - INTERVAL '5 minutes'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, userId]);
    return result.rows.length > 0 ? result.rows[0] as MotionPageUpdate : null;
  }

  async logUpdate(
    data: {
      page_id: string;
      user_id: string | null;
      action_type: string;
      description?: string | null;
      before_title?: string | null;
      before_content?: any | null;
      deleted_content?: string[] | null;
      added_content?: string[] | null;
    },
    client?: PoolClient
  ): Promise<MotionPageUpdate> {
    const query = `
      INSERT INTO public.motion_page_updates 
        (page_id, user_id, action_type, description, before_title, before_content, deleted_content, added_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [
      data.page_id,
      data.user_id,
      data.action_type,
      data.description ?? null,
      data.before_title ?? null,
      data.before_content ? JSON.stringify(data.before_content) : null,
      data.deleted_content ? JSON.stringify(data.deleted_content) : null,
      data.added_content ? JSON.stringify(data.added_content) : null,
    ]);
    return result.rows[0] as MotionPageUpdate;
  }

  async updateUpdateSession(
    id: string,
    data: {
      deleted_content: string[] | null;
      added_content: string[] | null;
      description?: string | null;
    },
    client?: PoolClient
  ): Promise<MotionPageUpdate> {
    const query = `
      UPDATE public.motion_page_updates
      SET deleted_content = $2,
          added_content = $3,
          description = COALESCE($4, description),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [
      id,
      data.deleted_content ? JSON.stringify(data.deleted_content) : null,
      data.added_content ? JSON.stringify(data.added_content) : null,
      data.description ?? null
    ]);
    return result.rows[0] as MotionPageUpdate;
  }

  async getUpdates(
    pageId: string,
    limit = 20,
    offset = 0,
    client?: PoolClient
  ): Promise<(MotionPageUpdate & { user_name: string | null; user_email: string | null })[]> {
    const query = `
      SELECT 
        u.*,
        usr.name AS user_name,
        usr.email AS user_email
      FROM public.motion_page_updates u
      LEFT JOIN public.users usr ON u.user_id = usr.id
      WHERE u.page_id = $1
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId, limit, offset]);
    return result.rows;
  }

  // ─── 4. Page Editors ────────────────────────────────────────────────────────

  async getPageCreator(
    pageId: string,
    client?: PoolClient
  ): Promise<(User & { created_at: Date }) | null> {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.name,
        mp.created_at
      FROM public.motion_pages mp
      INNER JOIN public.users u ON mp.created_by = u.id
      WHERE mp.id = $1
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId]);
    return result.rows.length > 0 ? result.rows[0] as any : null;
  }

  async getRecentEditors(
    pageId: string,
    client?: PoolClient
  ): Promise<(User & { last_edited_at: Date })[]> {
    // Finds distinct users who have logged edits on the page
    const query = `
      SELECT DISTINCT ON (u.user_id)
        usr.id,
        usr.email,
        usr.name,
        u.updated_at AS last_edited_at
      FROM public.motion_page_updates u
      INNER JOIN public.users usr ON u.user_id = usr.id
      WHERE u.page_id = $1
      ORDER BY u.user_id, u.updated_at DESC
    `;
    const executor = client || this.pool;
    const result = await executor.query(query, [pageId]);
    
    // Sort by last_edited_at DESC
    return (result.rows as any[]).sort((a, b) => 
      new Date(b.last_edited_at).getTime() - new Date(a.last_edited_at).getTime()
    );
  }
}
