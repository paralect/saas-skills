#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const USAGE = `Usage: node upload-to-cdn.mjs <folder> <file> [file …]

Uploads files to an S3-compatible bucket (Cloudflare R2, AWS S3, MinIO, Garage…)
under <folder>/ and prints each file's public URL with its HTTP status.

Reads these variables from the environment, or from a .env / .env.local file in
the current directory:

  CDN_ENDPOINT           https://<account-id>.r2.cloudflarestorage.com, https://s3.<region>.amazonaws.com, …
  CDN_BUCKET             the bucket name
  CDN_ACCESS_KEY_ID      a key with write access to the bucket
  CDN_SECRET_ACCESS_KEY
  CDN_PUBLIC_URL         where the bucket is served from, e.g. https://cdn.example.com
  CDN_REGION             optional; "auto" for R2 (default), the bucket's region for S3`;

const REQUIRED = ['CDN_ENDPOINT', 'CDN_BUCKET', 'CDN_ACCESS_KEY_ID', 'CDN_SECRET_ACCESS_KEY', 'CDN_PUBLIC_URL'];
const SERVICE = 's3';
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
};

const readEnvFile = (file) =>
  existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line) => /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
          .filter(Boolean)
          .map(([, name, value]) => [name, value.replace(/^(['"])(.*)\1$/, '$2')]),
      )
    : {};

const env = {
  ...readEnvFile(join(process.cwd(), '.env')),
  ...readEnvFile(join(process.cwd(), '.env.local')),
  ...process.env,
};

const [folder, ...files] = process.argv.slice(2);
const missing = REQUIRED.filter((name) => !env[name]);

if (!folder || !files.length || missing.length) {
  console.error(missing.length ? `Missing ${missing.join(', ')}\n\n${USAGE}` : USAGE);
  process.exit(1);
}

const endpoint = env.CDN_ENDPOINT.replace(/\/+$/, '');
const region = env.CDN_REGION || 'auto';
const publicUrl = env.CDN_PUBLIC_URL.replace(/\/+$/, '');

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

const signingKey = (date) =>
  [date, region, SERVICE, 'aws4_request'].reduce((key, part) => hmac(key, part), `AWS4${env.CDN_SECRET_ACCESS_KEY}`);

const put = async (key, body, contentType) => {
  const url = new URL(`${endpoint}/${env.CDN_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = stamp.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = {
    'content-length': String(body.byteLength),
    'content-type': contentType,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    'PUT',
    url.pathname,
    '',
    ...names.map((name) => `${name}:${headers[name]}`),
    '',
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${date}/${region}/${SERVICE}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const signature = createHmac('sha256', signingKey(date)).update(toSign).digest('hex');

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${env.CDN_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`${key}: the bucket answered ${response.status} ${await response.text()}`);
  }
};

for (const file of files) {
  const name = basename(file);
  const key = `${folder.replace(/^\/+|\/+$/g, '')}/${name}`;
  const extension = name.split('.').pop()?.toLowerCase() ?? '';

  await put(key, readFileSync(file), CONTENT_TYPES[extension] ?? 'application/octet-stream');

  const url = `${publicUrl}/${key}`;
  const check = await fetch(url, { method: 'HEAD' });

  console.log(`${check.status} ${url}`);
}
