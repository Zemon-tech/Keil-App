import pool from "../config/pg";
import { v4 as uuidv4 } from "uuid";
import * as mockData from "./mockChatData";
import { chatService } from "../services/chat.service";

async function seedDemoChats() {
    try {
        console.log("Seeding Demo Chats...");

        // 1. Get the first workspace as the target
        const wsRes = await pool.query('SELECT id, owner_id FROM workspaces LIMIT 1');
        if (wsRes.rowCount === 0) {
            console.log("No workspace found. Please run the app and create a workspace first.");
            process.exit(1);
        }
        const workspaceId = wsRes.rows[0].id;
        const ownerId = wsRes.rows[0].owner_id;

        // 2. Fetch or create users u1..u4 in standard public.users 
        // We will map u1 to the workspace owner.
        // u2, u3, u4, bot will be created if they don't exist.
        // Note: For real Supabase, inserting into auth.users requires admin API.
        // If we can't create them, we just map everything to the owner for now, 
        // or actually we can just insert them directly into public.users? Wait, public.users has FK to auth.users.
        // We can just query all members of the workspace. If there are fewer than 4, it's hard to fake.
        
        // Actually, we'll try inserting into auth.users directly. Local supabase allows it without API if we just use SQL.
        
        const dummyUsers = [
            { id: uuidv4(), rawId: 'u2', email: "ankit@demo.com", name: "Ankit" },
            { id: uuidv4(), rawId: 'u3', email: "priya@demo.com", name: "Priya" },
            { id: uuidv4(), rawId: 'u4', email: "saurabh@demo.com", name: "Saurabh" },
            { id: uuidv4(), rawId: 'bot', email: "bot@demo.com", name: "Keil AI" },
        ];

        let userMap: Record<string, string> = { "u1": ownerId };

        for (const u of dummyUsers) {
            // Check if email exists
            let existRes = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
            if (existRes.rowCount && existRes.rowCount > 0) {
                userMap[u.rawId] = existRes.rows[0].id;
            } else {
                try {
                    // Try to insert into auth.users first, because of the foreign key
                    await pool.query('INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [
                        '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, 'pass', new Date(), '{}', '{}', new Date(), new Date()
                    ]);
                    await pool.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [u.id, u.email, u.name]);
                    userMap[u.rawId] = u.id;
                    // Add them to workspace
                    await pool.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [workspaceId, u.id, 'member']);
                } catch (e) {
                    console.log(`Failed to create dummy user ${u.name}, falling back to owner.`);
                    userMap[u.rawId] = ownerId;
                }
            }
        }

        // Add them to array of member ids
        const allMemberIds = Object.values(userMap);

        for (const channel of mockData.DEMO_CHANNELS) {
            console.log(`Creating channel: ${channel.name}`);
            const realName = channel.name.replace('# ', ''); // remove hashtag
            const channelId = uuidv4();
            await pool.query(`INSERT INTO channels (id, workspace_id, type, name, privacy) VALUES ($1, $2, $3, $4, $5)`, [
                channelId, workspaceId, 'group', realName, 'public'
            ]);

            for (const mid of allMemberIds) {
                await pool.query(`INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [channelId, mid, 'member']);
            }

            // Insert messages
            for (const msg of channel.messages) {
                const senderId = userMap[msg.sender.id] || ownerId;
                await pool.query(`INSERT INTO messages (id, channel_id, sender_id, content, created_at) VALUES ($1, $2, $3, $4, $5)`, [
                    uuidv4(), channelId, senderId, msg.content, msg.created_at
                ]);
            }
        }

        console.log("Demo chats seeded successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error seeding demo chats:", e);
        process.exit(1);
    }
}

seedDemoChats();
