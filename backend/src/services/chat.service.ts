import pool from "../config/pg";

export class ChatService {

    static async getDirectChannel(workspaceId: string, user1: string, user2: string) {
        const query = `
            SELECT c.id 
            FROM channels c
            JOIN channel_members cm1 ON c.id = cm1.channel_id AND cm1.user_id = $2
            JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id = $3
            WHERE c.workspace_id = $1 AND c.type = 'direct'
        `;
        const result = await pool.query(query, [workspaceId, user1, user2]);
        return result.rows.length > 0 ? result.rows[0].id : null;
    }

    static async createDirectChannel(workspaceId: string, user1: string, user2: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertChannelQuery = `
                INSERT INTO channels (workspace_id, type)
                VALUES ($1, 'direct') RETURNING *
            `;
            const channelResult = await client.query(insertChannelQuery, [workspaceId]);
            const channel = channelResult.rows[0];

            // 3-Person Bug Safeguard: Only exactly 2 records inserted.
            const insertMembersQuery = `
                INSERT INTO channel_members (channel_id, user_id)
                VALUES ($1, $2), ($1, $3)
            `;
            await client.query(insertMembersQuery, [channel.id, user1, user2]);

            await client.query('COMMIT');
            return channel;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    static async createGroupChannel(workspaceId: string, name: string, memberIds: string[]) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertChannelQuery = `
                INSERT INTO channels (workspace_id, name, type)
                VALUES ($1, $2, 'group') RETURNING *
            `;
            const channelResult = await client.query(insertChannelQuery, [workspaceId, name]);
            const channel = channelResult.rows[0];

            for (const userId of memberIds) {
                await client.query(
                    `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [channel.id, userId]
                );
            }

            await client.query('COMMIT');
            return channel;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    static async getUserChannels(workspaceId: string, userId: string) {
        const query = `
            SELECT 
                c.id, c.type, c.name, coalesce(c.last_message_at, c.created_at) as last_message_at, c.created_at,
                (
                    SELECT json_agg(json_build_object('id', u.id, 'name', u.name))
                    FROM channel_members cm2
                    JOIN users u ON u.id = cm2.user_id
                    WHERE cm2.channel_id = c.id
                ) AS members,
                COUNT(m.id) AS unread_count
            FROM channels c
            JOIN channel_members cm ON c.id = cm.channel_id
            LEFT JOIN messages m ON m.channel_id = c.id AND m.created_at > cm.last_read_at AND m.sender_id != $2
            WHERE c.workspace_id = $1 AND cm.user_id = $2
            GROUP BY c.id, c.type, c.name, c.created_at, c.last_message_at
            ORDER BY last_message_at DESC
        `;
        const result = await pool.query(query, [workspaceId, userId]);
        return result.rows;
    }

    static async getChannelMessages(workspaceId: string, userId: string, channelId: string, limit: number = 50, beforeId?: string) {
        let query = `
            SELECT m.id, m.channel_id, m.content, m.created_at, json_build_object('id', u.id, 'name', u.name) as sender
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            JOIN channels c ON c.id = m.channel_id
            JOIN channel_members cm ON cm.channel_id = c.id
            WHERE m.channel_id = $1 AND c.workspace_id = $2 AND cm.user_id = $3
        `;
        const params: any[] = [channelId, workspaceId, userId, limit];
        if (beforeId) {
            query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $5)`;
            params.push(beforeId);
        }
        query += ` ORDER BY m.created_at DESC LIMIT $4`;
        const result = await pool.query(query, params);
        return result.rows;
    }

    static async markAsRead(workspaceId: string, userId: string, channelId: string) {
        const query = `
            UPDATE channel_members
            SET last_read_at = NOW()
            WHERE channel_id = $1 AND user_id = $2
            AND EXISTS (SELECT 1 FROM channels c WHERE c.id = $1 AND c.workspace_id = $3)
        `;
        await pool.query(query, [channelId, userId, workspaceId]);
    }

    static async fetchUserWorkspaceRole(workspaceId: string, userId: string) {
        const result = await pool.query(
            `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, userId]
        );
        return result.rows[0]?.role || null;
    }

    static async getChannelById(channelId: string) {
         const result = await pool.query(`SELECT * FROM channels WHERE id = $1`, [channelId]);
         return result.rows[0];
    }
}
