import pool from "../config/pg";
import { v4 as uuidv4 } from "uuid";

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
    async findDirectChannel(userId1: string, userId2: string, workspaceId: string) {
        // Query to find an existing direct channel between two users in the same workspace
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

    async createChannel(workspaceId: string, type: 'direct' | 'group', name: string | null, memberIds: string[], creatorId?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const channelId = uuidv4();
            
            // 1. Create channel
            await client.query(`
                INSERT INTO channels (id, workspace_id, type, name)
                VALUES ($1, $2, $3, $4)
            `, [channelId, workspaceId, type, name]);

            // 2. Add members
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
        // Complex query to get user's channels, joining members and calculating unread_count
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
                ) as unread_count,
                COALESCE(
                    json_agg(
                        json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
                    ) FILTER (WHERE u.id IS NOT NULL), 
                    '[]'
                ) as members
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
            last_message_at: row.last_message_at,
            // For direct channels, filter out the current user to get the "other person"
            members: row.type === 'direct' 
                ? row.members.filter((m: any) => m.id !== userId) 
                : row.members
        }));
    },

    async getChannelById(channelId: string, userId: string) {
        const result = await pool.query(`
            SELECT 
                c.id, c.type, c.name, c.last_message_at,
                0 as unread_count,
                COALESCE(
                    json_agg(
                        json_build_object('id', u.id, 'name', COALESCE(u.name, u.email))
                    ) FILTER (WHERE u.id IS NOT NULL), 
                    '[]'
                ) as members
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
            last_message_at: row.last_message_at,
            members: row.type === 'direct' 
                ? row.members.filter((m: any) => m.id !== userId) 
                : row.members
        };
    },

    async getChannelMessages(channelId: string, limit: number = 50, beforeId?: string) {
        let query = `
            SELECT 
                m.id, 
                m.channel_id, 
                m.content, 
                m.created_at,
                json_build_object('id', u.id, 'name', COALESCE(u.name, u.email)) as sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.channel_id = $1
        `;
        const params: any[] = [channelId];

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
        // Reverse so chronological order is maintained (oldest first in UI)
        return result.rows.reverse();
    },

    async markAsRead(channelId: string, userId: string) {
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

        // Fetch sender details
        const senderResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [senderId]);
        const sender = senderResult.rows[0];

        // Mark as read for the sender immediately
        await this.markAsRead(channelId, senderId);

        return {
            id: result.rows[0].id,
            channel_id: result.rows[0].channel_id,
            content: result.rows[0].content,
            created_at: result.rows[0].created_at,
            sender: {
                id: sender.id,
                name: sender.name || sender.email
            }
        };
    },
    
    async getChannelMemberIds(channelId: string) {
        const res = await pool.query('SELECT user_id FROM channel_members WHERE channel_id = $1', [channelId]);
        return res.rows.map(r => r.user_id);
    },

    async addMembers(channelId: string, memberIds: string[]) {
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

    async removeMember(channelId: string, userId: string) {
        await pool.query(`
            DELETE FROM channel_members
            WHERE channel_id = $1 AND user_id = $2
        `, [channelId, userId]);
    }
};
