import crypto from 'crypto';
import { pool } from './db';
import { config } from './config';

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) return false;
  const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(derivedHash, 'hex'));
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload: object) {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = base64Url(crypto.createHmac('sha256', config.authTokenSecret).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
}

function readSignedPayload(token: string) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = base64Url(crypto.createHmac('sha256', config.authTokenSecret).update(payload).digest());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub: string; exp: number };
  if (Date.now() > parsed.exp) return null;
  return parsed;
}

async function mapUserById(id: string) {
  const result = await pool.query<SafeUser>(
    `select
       id,
       pgp_sym_decrypt(email_encrypted, $2) as email,
       pgp_sym_decrypt(display_name_encrypted, $2) as "displayName"
     from users
     where id = $1`,
    [id, config.dataEncryptionKey]
  );
  return result.rows[0] ?? null;
}

export async function registerUser(input: { email: string; password: string; displayName: string }) {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  if (!email || !displayName || input.password.length < 8) throw new Error('Please enter a valid email, display name, and password.');

  const emailHash = sha256(email);
  const passwordHash = hashPassword(input.password);

  try {
    const result = await pool.query<{ id: string }>(
      `insert into users (email_hash, email_encrypted, display_name_encrypted, password_hash)
       values ($1, pgp_sym_encrypt($2, $5), pgp_sym_encrypt($3, $5), $4)
       returning id`,
      [emailHash, email, displayName, passwordHash, config.dataEncryptionKey]
    );
    const user = await mapUserById(result.rows[0].id);
    if (!user) throw new Error('Failed to load user');
    return user;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create account';
    if (message.includes('users_email_hash_key')) throw new Error('An account with that email already exists.');
    throw error;
  }
}

export async function authenticateUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const emailHash = sha256(email);
  const result = await pool.query<{ id: string; password_hash: string }>(
    `select id, password_hash from users where email_hash = $1`,
    [emailHash]
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(input.password, row.password_hash)) throw new Error('Incorrect email or password.');
  const user = await mapUserById(row.id);
  if (!user) throw new Error('Account no longer exists.');
  return user;
}

export function issueAuthToken(userId: string) {
  return signPayload({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 });
}

export async function getUserFromBearerToken(token: string | undefined) {
  if (!token) return null;
  const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
  const payload = readSignedPayload(raw);
  if (!payload) return null;
  return mapUserById(payload.sub);
}
