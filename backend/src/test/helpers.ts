/**
 * Test Helpers
 * Seed functions for creating test data in the local test database.
 */
import pool from "../config/pg";

/**
 * Seed a user into both auth.users and public.users.
 * Returns the public.users row.
 */
export async function seedUser(id: string, email: string, name: string) {
    // Insert into auth.users (simulates Supabase auth)
    await pool.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = $2, raw_user_meta_data = $3`,
        [id, email, JSON.stringify({ full_name: name })]
    );

    // Insert into public.users (the app's user table)
    const result = await pool.query(
        `INSERT INTO public.users (id, email, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = $2, name = $3
         RETURNING *`,
        [id, email, name]
    );
    return result.rows[0];
}

/**
 * Seed an organisation and add the owner as a member.
 * Returns the organisation row.
 */
export async function seedOrg(id: string, name: string, ownerUserId: string) {
    const result = await pool.query(
        `INSERT INTO public.organisations (id, name, owner_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = $2, owner_user_id = $3
         RETURNING *`,
        [id, name, ownerUserId]
    );

    // Add owner as org member
    await pool.query(
        `INSERT INTO public.organisation_members (org_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (org_id, user_id) DO NOTHING`,
        [id, ownerUserId]
    );

    return result.rows[0];
}

/**
 * Seed a space within an organisation.
 * Returns the space row.
 */
export async function seedSpace(id: string, orgId: string, name: string, createdBy: string) {
    const result = await pool.query(
        `INSERT INTO public.spaces (id, org_id, name, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [id, orgId, name, createdBy]
    );

    // Add creator as space member
    await pool.query(
        `INSERT INTO public.space_members (org_id, space_id, user_id, role)
         VALUES ($1, $2, $3, 'owner')
         ON CONFLICT (space_id, user_id) DO NOTHING`,
        [orgId, id, createdBy]
    );

    return result.rows[0];
}

/**
 * Seed a channel within an org/space.
 * Returns the channel row.
 */
export async function seedChannel(id: string, orgId: string, spaceId: string, name: string, createdBy: string) {
    const result = await pool.query(
        `INSERT INTO public.channels (id, org_id, space_id, type, name)
         VALUES ($1, $2, $3, 'group', $4)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [id, orgId, spaceId, name]
    );

    // Add creator as channel member
    await pool.query(
        `INSERT INTO public.channel_members (channel_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [id, createdBy]
    );

    return result.rows[0];
}
