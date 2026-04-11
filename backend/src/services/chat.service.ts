import pool from "../config/pg";

// ---------------------------------------------------------------------------
// Shared helper: safely convert a Date or ISO string to ISO string.
// pg auto-parses top-level TIMESTAMPTZ columns into Date objects, but values
// inside json_build_object() come back as plain strings — handle both.
// ---------------------------------------------------------------------------
const toISO = (val: Date | string): string =>
    val instanceof Date ? val.toISOString() : val as string;

interface ChatMember {
    id: string;
    name: string | null;
}

interface Channel {
    id: string;
    type: 'direct' | 'group';
    name: string | null;
    unread_count: number;
    last_message_at: string | null;
    members: ChatMember[];
}

export const chatService = {

    async findDirectChannel(userId1: string, userId2: string, workspaceId: string): Promise<string | null> {
        const result = await pool.query(`
            SELECT c.id
            FROM channels c
            JOIN channel_members cm1 ON c.id = cm1.channel_id
            JOIN channel_members cm2 ON c.id = cm2.channel_id
            WHERE c.type = 'direct'
            AND c.workspace_id = $1
            AND cm1.user_id = $2
            AND cm2.user_id = $3
            LIMIT 1
        `, [workspaceId, userId1, userId2]);

        return result.rows[0]?.id || null;
    },

    async createChannel(
        workspaceId: string,
        type: 'direct' | 'group',
        name: string | null,
        memberIds: string[],
        creatorId?: string
    ): Promise<string> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Let Postgres generate the UUID via gen_random_uuid() default
            const channelResult = await client.query(`
                INSERT INTO channels (workspace_id, type, name)
                VALUES ($1, $2, $3)
                RETURNING id
            `, [workspaceId, type, name]);

            const channelId = channelResult.rows[0].id;

            // Add members — creator of a group gets 'admin' role
            for (const memberId of memberIds) {
                const role = (type === 'group' && memberId === creatorId) ? 'admin' : 'member';
                await client.query(`
                    INSERT INTO channel_members (channel_id, user_id, role)
                    VALUES ($1, $2, $3)
                `, [channelId, memberId, role]);
            }

            await client.query('COMMIT');
            return channelId;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },

    async getUserChannels(userId: string, workspaceId: string): Promise<Channel[]> {
        const result = await pool.query(`
            SELECT
                c.id,
                c.type,
                c.name,
                c.last_message_at,
                (
                    SELECT COUNT(*)
                    FROM messages m
                    JOIN channel_members cm_me ON m.channel_id = cm_me.channel_id AND cm_me.user_id = $1
                    WHERE m.channel_id = c.id
                    AND m.created_at > cm_me.last_read_at
                ) AS unread_count,
                COALESCE(
                    json_agg(
                        json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
                    ) FILTER (WHERE u.id IS NOT NULL),
                    '[]'
                ) AS members
            FROM channels c
            JOIN channel_members cm ON c.id = cm.channel_id
            JOIN channel_members cm_all ON c.id = cm_all.channel_id
            JOIN users u ON cm_all.user_id = u.id
            WHERE cm.user_id = $1 AND c.workspace_id = $2
            GROUP BY c.id
            ORDER BY c.last_message_at DESC NULLS LAST
        `, [userId, workspaceId]);

        return result.rows.map(row => ({
            id: row.id,
            type: row.type,
            name: row.name,
            unread_count: parseInt(row.unread_count, 10),
            last_message_at: row.last_message_at ? toISO(row.last_message_at) : null,
            // For direct channels, filter out the current user to show only the other person
            members: row.type === 'direct'
                ? row.members.filter((m: any) => m.id !== userId)
                : row.members
        }));
    },

    async getChannelById(channelId: string, userId: string): Promise<Channel | null> {
        const result = await pool.query(`
            SELECT
                c.id, c.type, c.name, c.last_message_at,
                0 AS unread_count,
                COALESCE(
                    json_agg(
                        json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
                    ) FILTER (WHERE u.id IS NOT NULL),
                    '[]'
                ) AS members
            FROM channels c
            JOIN channel_members cm_all ON c.id = cm_all.channel_id
            JOIN users u ON cm_all.user_id = u.id
            WHERE c.id = $1
            GROUP BY c.id
        `, [channelId]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            type: row.type,
            name: row.name,
            unread_count: 0,
            last_message_at: row.last_message_at ? toISO(row.last_message_at) : null,
            members: row.type === 'direct'
                ? row.members.filter((m: any) => m.id !== userId)
                : row.members
        };
    },

    async getChannelMessages(channelId: string, limit: number = 50, beforeId?: string) {
        const params: any[] = [channelId];
        let query = `
            SELECT
                m.id,
                m.channel_id,
                m.content,
                m.created_at,
                json_build_object('id', u.id, 'name', COALESCE(u.name, u.email)) AS sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.channel_id = $1
        `;

        if (beforeId) {
            query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)`;
            params.push(beforeId);
            params.push(limit);
            query += ` ORDER BY m.created_at DESC LIMIT $3`;
        } else {
            params.push(limit);
            query += ` ORDER BY m.created_at DESC LIMIT $2`;
        }

        const result = await pool.query(query, params);
        // Reverse to return oldest-first (chronological order for the UI)
        return result.rows.reverse().map(row => ({
            ...row,
            created_at: toISO(row.created_at)
        }));
    },

    async markAsRead(channelId: string, userId: string): Promise<void> {
        await pool.query(`
            UPDATE channel_members
            SET last_read_at = NOW()
            WHERE channel_id = $1 AND user_id = $2
        `, [channelId, userId]);
    },

    async saveMessage(channelId: string, senderId: string, content: string) {
        const result = await pool.query(`
            INSERT INTO messages (channel_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING id, channel_id, content, created_at
        `, [channelId, senderId, content]);

        const senderResult = await pool.query(
            `SELECT id, name, email FROM users WHERE id = $1`,
            [senderId]
        );
        const sender = senderResult.rows[0];

        // Sender red-dot fix: mark as read immediately for the sender
        await this.markAsRead(channelId, senderId);

        return {
            id: result.rows[0].id,
            channel_id: result.rows[0].channel_id,
            content: result.rows[0].content,
            created_at: toISO(result.rows[0].created_at),
            sender: {
                id: sender.id,
                name: sender.name || sender.email
            }
        };
    },

    async getChannelMemberIds(channelId: string): Promise<string[]> {
        const res = await pool.query(
            'SELECT user_id FROM channel_members WHERE channel_id = $1',
            [channelId]
        );
        return res.rows.map(r => r.user_id);
    },

    async addMembers(channelId: string, memberIds: string[]): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const memberId of memberIds) {
                await client.query(`
                    INSERT INTO channel_members (channel_id, user_id, role)
                    VALUES ($1, $2, 'member')
                    ON CONFLICT DO NOTHING
                `, [channelId, memberId]);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },

    async removeMember(channelId: string, userId: string): Promise<void> {
        await pool.query(`
            DELETE FROM channel_members
            WHERE channel_id = $1 AND user_id = $2
        `, [channelId, userId]);
    }
};
