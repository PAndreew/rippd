import fs from 'fs/promises';
import path from 'path';
import { pool } from './db';
import { connectRedis } from './redis';

async function ensureSchema() {
  const sqlPath = path.resolve(__dirname, '../../../infra/postgres/init.sql');
  const sql = await fs.readFile(sqlPath, 'utf8');
  await pool.query(sql);
}

export async function connectInfrastructure() {
  await connectRedis();
  await pool.query('select 1');
  await ensureSchema();
  console.log('Infrastructure ready: Redis + Postgres connected');
}
