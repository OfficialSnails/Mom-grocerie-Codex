import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

// Explicit setup command only. Never run DDL on a visitor request.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = neon(process.env.DATABASE_URL);
await sql.transaction([
  sql`CREATE TABLE IF NOT EXISTS grocery_profiles (
    owner_id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS grocery_lists (
    owner_id text NOT NULL, list_id text NOT NULL, snapshot jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner_id, list_id),
    CHECK (snapshot->>'id' = list_id)
  )`,
]);
console.log('Grocery account schema ready. No existing rows changed.');
