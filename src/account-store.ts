import { neon } from '@neondatabase/serverless';
import type { AccountRepository } from './account-data.js';

// Every statement scopes its rows to the verified Clerk subject. List IDs are not credentials.
export function accountStore(connection: string): AccountRepository {
  const sql = neon(connection);
  return {
    async profile(owner) {
      const rows = await sql`SELECT data FROM grocery_profiles WHERE owner_id = ${owner}`;
      return rows[0]?.data ?? {};
    },
    async saveProfile(owner, profile) {
      const rows = await sql`INSERT INTO grocery_profiles (owner_id, data) VALUES (${owner}, ${JSON.stringify(profile)}::jsonb)
        ON CONFLICT (owner_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING data`;
      return rows[0].data;
    },
    async lists(owner) {
      const rows = await sql`SELECT snapshot FROM grocery_lists WHERE owner_id = ${owner} ORDER BY updated_at DESC`;
      return rows.map(row => row.snapshot);
    },
    async saveList(owner, snapshot, importOnly) {
      if (importOnly) {
        const rows = await sql`INSERT INTO grocery_lists (owner_id, list_id, snapshot)
          VALUES (${owner}, ${snapshot.id}, ${JSON.stringify(snapshot)}::jsonb)
          ON CONFLICT (owner_id, list_id) DO NOTHING RETURNING list_id`;
        return rows.length > 0;
      }
      await sql`INSERT INTO grocery_lists (owner_id, list_id, snapshot)
        VALUES (${owner}, ${snapshot.id}, ${JSON.stringify(snapshot)}::jsonb)
        ON CONFLICT (owner_id, list_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`;
      return true;
    },
    async removeList(owner, id) {
      await sql`DELETE FROM grocery_lists WHERE owner_id = ${owner} AND list_id = ${id}`;
    },
    async clear(owner) {
      await sql.transaction([
        sql`DELETE FROM grocery_lists WHERE owner_id = ${owner}`,
        sql`DELETE FROM grocery_profiles WHERE owner_id = ${owner}`,
      ]);
    },
  };
}
