import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const env = process.env;
const secureURL = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const validDsn = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !!url.username && !url.password && !url.search && !url.hash && /\/\d+$/.test(url.pathname); } catch { return false; } };
const checks = [];
const add = (name, ready, required = true) => checks.push({ name, ready: Boolean(ready), required });
add('Public HTTPS URL', secureURL(env.NEXT_PUBLIC_APP_URL));
add('Supabase URL', secureURL(env.NEXT_PUBLIC_SUPABASE_URL));
add('Supabase public auth key', env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
add('Supabase server key', env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY);
add('Encryption key', /^[A-Za-z0-9+/]{43}=$/.test(env.APP_ENCRYPTION_KEY || '') && Buffer.from(env.APP_ENCRYPTION_KEY || '', 'base64').length === 32);
add('CLEAR Free live provider', env.GEMINI_API_KEY && env.CLEAR_PROVIDER !== 'mock');
add('Trusted Vercel client IP', ['x-forwarded-for', 'x-vercel-forwarded-for'].includes(env.CLEAR_TRUSTED_IP_HEADER));
add('Server monitoring', validDsn(env.SENTRY_DSN), false);
add('Browser monitoring', validDsn(env.NEXT_PUBLIC_SENTRY_DSN), false);

if (process.argv.includes('--remote') && checks.find((check) => check.name === 'Supabase URL').ready && checks.find((check) => check.name === 'Supabase server key').ready) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) } });
  const tables = ['conversations', 'messages', 'explanation_documents', 'attachments', 'lesson_share_snapshots', 'clear_private_state', 'clear_limit_events', 'clear_limit_leases', 'clear_lesson_cleanup_jobs'];
  await Promise.all(tables.map(async (table) => {
    const column = table === 'clear_private_state' ? 'record_key' : table.startsWith('clear_limit_') ? 'bucket' : ['lesson_share_snapshots', 'clear_lesson_cleanup_jobs'].includes(table) ? 'conversation_id' : 'id';
    try { const result = await db.from(table).select(column).limit(0); add(`Schema: ${table}`, !result.error); } catch { add(`Schema: ${table}`, false); }
  }));
  try {
    const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    const schema = response.ok ? await response.json() : {};
    for (const rpc of ['clear_save_lesson', 'clear_consume_limits', 'clear_release_limit_lease', 'clear_delete_account_lesson']) add(`Server function: ${rpc}`, Boolean(schema.paths?.[`/rpc/${rpc}`]));
  } catch { add('Server functions discoverable', false); }
  try { const { data, error } = await db.storage.getBucket('clear-uploads'); add('Upload bucket is private', !error && data && data.public === false); } catch { add('Upload bucket is private', false); }
}
for (const check of checks) console.info(`${check.ready ? 'PASS' : check.required ? 'MISSING' : 'OPTIONAL'} ${check.name}`);
console.info('No secrets or learner data printed. Remote mode performs read-only setup checks. Live password sign-in, voice devices and model quality still need launch checks. Sentry and custom email delivery are deferred.');
process.exitCode = checks.every((check) => !check.required || check.ready) ? 0 : 1;
