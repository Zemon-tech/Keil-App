import pool from "../config/pg";
import { ApiError } from "../utils/ApiError";

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export interface ChatChannelDTO {
  id: string;
  org_id: string | null;
  space_id: string | null;
  type: "direct" | "group";
  name: string | null;
  unread_count: number;
  last_message_at: string | null;
  members: Array<{ id: string; name: string | null }>;
}

export const findDirectChannel = async (
  userId1: string,
  userId2: string,
  orgId: string,
  spaceId: string,
): Promise<string | null> => {
  const result = await pool.query(
    `
      SELECT c.id
      FROM public.channels c
      JOIN public.channel_members cm1 ON c.id = cm1.channel_id
      JOIN public.channel_members cm2 ON c.id = cm2.channel_id
      WHERE c.type = 'direct'
        AND c.org_id = $1
        AND c.space_id = $2
        AND cm1.user_id = $3
        AND cm2.user_id = $4
      LIMIT 1
    `,
    [orgId, spaceId, userId1, userId2],
  );

  return result.rows[0]?.id ?? null;
};

export const createChannel = async (
  workspaceId: string,
  orgId: string,
  spaceId: string,
  type: "direct" | "group",
  name: string | null,
  memberIds: string[],
  creatorId?: string,
): Promise<string> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const memberCheck = await client.query(
      `
        SELECT user_id
        FROM public.space_members
        WHERE org_id = $1
          AND space_id = $2
          AND user_id = ANY($3::uuid[])
      `,
      [orgId, spaceId, memberIds],
    );

    if (memberCheck.rows.length !== memberIds.length) {
      throw new ApiError(400, "All channel members must belong to the active space");
    }

    const channelResult = await client.query(
      `
        INSERT INTO public.channels (workspace_id, org_id, space_id, type, name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [workspaceId, orgId, spaceId, type, name],
    );

    const channelId = channelResult.rows[0].id as string;

    for (const memberId of memberIds) {
      const role = type === "group" && memberId === creatorId ? "admin" : "member";
      await client.query(
        `
          INSERT INTO public.channel_members (channel_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `,
        [channelId, memberId, role],
      );
    }

    await client.query("COMMIT");
    return channelId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getUserChannels = async (
  userId: string,
  orgId: string,
  spaceId: string,
): Promise<ChatChannelDTO[]> => {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.org_id,
        c.space_id,
        c.type,
        c.name,
        c.last_message_at,
        (
          SELECT COUNT(*)
          FROM public.messages m
          JOIN public.channel_members cm_me
            ON m.channel_id = cm_me.channel_id
           AND cm_me.user_id = $1
          WHERE m.channel_id = c.id
            AND m.created_at > cm_me.last_read_at
        ) AS unread_count,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members
      FROM public.channels c
      JOIN public.channel_members cm ON c.id = cm.channel_id
      JOIN public.channel_members cm_all ON c.id = cm_all.channel_id
      JOIN public.users u ON cm_all.user_id = u.id
      WHERE cm.user_id = $1
        AND c.org_id = $2
        AND c.space_id = $3
      GROUP BY c.id
      ORDER BY c.last_message_at DESC NULLS LAST
    `,
    [userId, orgId, spaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    space_id: row.space_id,
    type: row.type,
    name: row.name,
    unread_count: parseInt(row.unread_count, 10),
    last_message_at: toISO(row.last_message_at),
    members:
      row.type === "direct"
        ? row.members.filter((member: any) => member.id !== userId)
        : row.members,
  }));
};

export const getChannelById = async (channelId: string, userId: string): Promise<ChatChannelDTO | null> => {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.org_id,
        c.space_id,
        c.type,
        c.name,
        c.last_message_at,
        0 AS unread_count,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members
      FROM public.channels c
      JOIN public.channel_members cm_all ON c.id = cm_all.channel_id
      JOIN public.users u ON cm_all.user_id = u.id
      WHERE c.id = $1
      GROUP BY c.id
    `,
    [channelId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    org_id: row.org_id,
    space_id: row.space_id,
    type: row.type,
    name: row.name,
    unread_count: 0,
    last_message_at: toISO(row.last_message_at),
    members: row.type === "direct" ? row.members.filter((member: any) => member.id !== userId) : row.members,
  };
};

export const getChannelMessages = async (channelId: string, limit = 50, beforeId?: string) => {
  const params: Array<string | number> = [channelId];
  let query = `
    SELECT
      m.id,
      m.channel_id,
      m.content,
      m.created_at,
      json_build_object('id', u.id, 'name', COALESCE(u.name, u.email)) AS sender
    FROM public.messages m
    JOIN public.users u ON m.sender_id = u.id
    WHERE m.channel_id = $1
  `;

  if (beforeId) {
    query += ` AND m.created_at < (SELECT created_at FROM public.messages WHERE id = $2)`;
    params.push(beforeId, limit);
    query += ` ORDER BY m.created_at DESC LIMIT $3`;
  } else {
    params.push(limit);
    query += ` ORDER BY m.created_at DESC LIMIT $2`;
  }

  const result = await pool.query(query, params);
  return result.rows.reverse().map((row) => ({
    ...row,
    created_at: toISO(row.created_at),
  }));
};

export const markAsRead = async (channelId: string, userId: string): Promise<void> => {
  await pool.query(
    `
      UPDATE public.channel_members
      SET last_read_at = NOW()
      WHERE channel_id = $1
        AND user_id = $2
    `,
    [channelId, userId],
  );
};

export const saveMessage = async (channelId: string, senderId: string, content: string) => {
  const result = await pool.query(
    `
      INSERT INTO public.messages (channel_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, channel_id, content, created_at
    `,
    [channelId, senderId, content],
  );

  const senderResult = await pool.query(
    `SELECT id, name, email FROM public.users WHERE id = $1`,
    [senderId],
  );
  const sender = senderResult.rows[0];

  await markAsRead(channelId, senderId);

  return {
    id: result.rows[0].id,
    channel_id: result.rows[0].channel_id,
    content: result.rows[0].content,
    created_at: toISO(result.rows[0].created_at),
    sender: {
      id: sender.id,
      name: sender.name || sender.email,
    },
  };
};

export const addMembers = async (
  orgId: string,
  spaceId: string,
  channelId: string,
  memberIds: string[],
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const memberCheck = await client.query(
      `
        SELECT user_id
        FROM public.space_members
        WHERE org_id = $1
          AND space_id = $2
          AND user_id = ANY($3::uuid[])
      `,
      [orgId, spaceId, memberIds],
    );

    if (memberCheck.rows.length !== memberIds.length) {
      throw new ApiError(400, "All channel members must belong to the active space");
    }

    for (const memberId of memberIds) {
      await client.query(
        `
          INSERT INTO public.channel_members (channel_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT DO NOTHING
        `,
        [channelId, memberId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const removeMember = async (channelId: string, userId: string): Promise<void> => {
  await pool.query(
    `
      DELETE FROM public.channel_members
      WHERE channel_id = $1
        AND user_id = $2
    `,
    [channelId, userId],
  );
};

export const getChannelMemberIds = async (channelId: string): Promise<string[]> => {
  const result = await pool.query(
    `SELECT user_id FROM public.channel_members WHERE channel_id = $1`,
    [channelId],
  );
  return result.rows.map((row) => row.user_id as string);
};
