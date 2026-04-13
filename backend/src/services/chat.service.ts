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
    privacy: 'public' | 'private' | 'secret';
    unread_count: number;
    last_message_at: string | null;
    members: ChatMember[];
}

export const chatService = {
    async findDirectChannel(userId1: string, userId2: string, workspaceId: string) {
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
        creatorId?: string,
        privacy: 'public' | 'private' | 'secret' = 'public'
    ) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const channelId = uuidv4();
            
            await client.query(`
                INSERT INTO channels (id, workspace_id, type, name, privacy)
                VALUES ($1, $2, $3, $4, $5)
            `, [channelId, workspaceId, type, name, privacy]);

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
                c.privacy,
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
            privacy: row.privacy ?? 'public',
            unread_count: parseInt(row.unread_count, 10),
            last_message_at: row.last_message_at,
            members: row.type === 'direct' 
                ? row.members.filter((m: any) => m.id !== userId) 
                : row.members
        }));
    },

    async getChannelById(channelId: string, userId: string) {
        const result = await pool.query(`
            SELECT 
                c.id, c.type, c.name, c.privacy, c.last_message_at,
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
            privacy: row.privacy ?? 'public',
            unread_count: 0,
            last_message_at: row.last_message_at,
            members: row.type === 'direct' 
                ? row.members.filter((m: any) => m.id !== userId) 
                : row.members
        };
    },

    async getChannelMessages(channelId: string, userId: string, limit: number = 50, beforeId?: string) {
        const channelAccess = await pool.query(`
            SELECT c.privacy, cm.joined_at 
            FROM channels c
            LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $2
            WHERE c.id = $1
        `, [channelId, userId]);

        if (channelAccess.rowCount === 0) {
            throw new Error('Channel not found');
        }

        const { privacy, joined_at } = channelAccess.rows[0];

        if (privacy === 'private' || privacy === 'secret') {
            if (!joined_at) throw new Error('403 Forbidden');
        }

        const isSecret = (privacy === 'secret');

        let query = `
            SELECT 
                m.id, 
                m.channel_id, 
                m.content, 
                m.created_at,
                m.updated_at,
                m.parent_id,
                m.is_pinned,
                m.pinned_at,
                m.task_id,
                m.is_edited,
                m.is_deleted,
                m.reactions,
                json_build_object('id', u.id, 'name', COALESCE(u.name, u.email)) as sender,
                (SELECT COUNT(*) FROM messages replies WHERE replies.parent_id = m.id) as thread_count
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.channel_id = $1 AND m.parent_id IS NULL
        `;
        const params: any[] = [channelId];
        let pIndex = 2;

        if (isSecret && joined_at) {
            query += ` AND m.created_at >= $${pIndex}`;
            params.push(joined_at);
            pIndex++;
        }

        if (beforeId) {
            query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${pIndex})`;
            params.push(beforeId);
            pIndex++;
        }

        query += ` ORDER BY m.created_at DESC LIMIT $${pIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);
        return result.rows.reverse().map(m => ({
            ...m,
            threadCount: parseInt(m.thread_count, 10)
        }));
    },

    async getThreadMessages(parentId: string) {
        const query = `
            SELECT 
                m.id, 
                m.channel_id, 
                m.content, 
                m.created_at,
                m.parent_id,
                m.is_edited,
                m.is_deleted,
                m.reactions,
                json_build_object('id', u.id, 'name', COALESCE(u.name, u.email)) as sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.parent_id = $1
            ORDER BY m.created_at ASC
        `;
        const result = await pool.query(query, [parentId]);
        return result.rows;
    },

    async markAsRead(channelId: string, userId: string) {
        await pool.query(`
            UPDATE channel_members
            SET last_read_at = NOW()
            WHERE channel_id = $1 AND user_id = $2
        `, [channelId, userId]);
    },

    async saveMessage(channelId: string, senderId: string, content: string, parentId?: string) {
        const result = await pool.query(`
            INSERT INTO messages (channel_id, sender_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, channel_id, content, created_at, parent_id, is_pinned, is_edited, is_deleted, reactions
        `, [channelId, senderId, content, parentId || null]);

        const senderResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [senderId]);
        const sender = senderResult.rows[0];

        await this.markAsRead(channelId, senderId);

        return {
            ...result.rows[0],
            sender: {
                id: sender.id,
                name: sender.name || sender.email
            }
        };
    },

    async editMessage(messageId: string, content: string, userId: string) {
        const result = await pool.query(`
            UPDATE messages 
            SET content = $1, is_edited = true, updated_at = NOW()
            WHERE id = $2 AND sender_id = $3 AND is_deleted = false
            RETURNING id, channel_id, content, is_edited, updated_at
        `, [content, messageId, userId]);
        return result.rows[0];
    },

    async deleteMessage(messageId: string, userId: string) {
        const result = await pool.query(`
            UPDATE messages 
            SET is_deleted = true, content = 'This message was deleted.', updated_at = NOW()
            WHERE id = $1 AND sender_id = $2
            RETURNING id, channel_id, is_deleted
        `, [messageId, userId]);
        return result.rows[0];
    },

    async pinMessage(messageId: string, isPinned: boolean) {
        const result = await pool.query(`
            UPDATE messages
            SET is_pinned = $1, pinned_at = CASE WHEN $1 THEN NOW() ELSE NULL END
            WHERE id = $2
            RETURNING id, channel_id, is_pinned
        `, [isPinned, messageId]);
        return result.rows[0];
    },

    async toggleReaction(messageId: string, emoji: string, userId: string) {
        // Toggle logic: fetch current reactions, see if user is in array for emoji.
        const res = await pool.query('SELECT reactions FROM messages WHERE id = $1', [messageId]);
        if (res.rowCount === 0) return null;
        
        let reactions = res.rows[0].reactions || {};
        const users = reactions[emoji] || [];
        
        if (users.includes(userId)) {
            reactions[emoji] = users.filter((u: string) => u !== userId);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
            reactions[emoji] = [...users, userId];
        }

        const updateRes = await pool.query(`
            UPDATE messages SET reactions = $1 WHERE id = $2 RETURNING id, channel_id, reactions
        `, [JSON.stringify(reactions), messageId]);
        return updateRes.rows[0];
    },

    async createTaskFromMessage(messageId: string, workspaceId: string, creatorId: string) {
        const msgRes = await pool.query('SELECT content FROM messages WHERE id = $1', [messageId]);
        if (msgRes.rowCount === 0) throw new Error("Message not found");
        
        const content = msgRes.rows[0].content;
        const taskId = uuidv4();
        await pool.query(`
            INSERT INTO tasks (id, workspace_id, title, description, status, priority, created_by)
            VALUES ($1, $2, $3, $4, 'todo', 'medium', $5)
        `, [taskId, workspaceId, 'Task from Chat', content, creatorId]);

        const updateRes = await pool.query(`
            UPDATE messages SET task_id = $1 WHERE id = $2 RETURNING id, channel_id, task_id
        `, [taskId, messageId]);
        
        return updateRes.rows[0];
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
    },

    async checkChannelAccess(userId: string, channelId: string): Promise<boolean> {
        const result = await pool.query(`
            SELECT c.privacy, cm.user_id IS NOT NULL as is_member
            FROM channels c
            LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $1
            WHERE c.id = $2
        `, [userId, channelId]);

        if (result.rowCount === 0) return false;
        
        const { privacy, is_member } = result.rows[0];
        
        if (privacy === 'public') return true;
        if (privacy === 'private' || privacy === 'secret') return is_member;
        
        return false;
    },

    async joinChannel(userId: string, channelId: string) {
        const channelResult = await pool.query(`SELECT privacy FROM channels WHERE id = $1`, [channelId]);
        if (channelResult.rowCount === 0) throw new Error('Channel not found');

        const { privacy } = channelResult.rows[0];

        if (privacy !== 'public') {
            throw new Error('403 Forbidden: Cannot join private or secret channel without explicitly being invited');
        }

        await pool.query(`
            INSERT INTO channel_members (channel_id, user_id, role, joined_at, last_read_at)
            VALUES ($1, $2, 'member', NOW(), NOW())
            ON CONFLICT DO NOTHING
        `, [channelId, userId]);
    }
};
