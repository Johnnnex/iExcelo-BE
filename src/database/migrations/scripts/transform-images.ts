/**
 * transform-images.ts
 *
 * Downloads all ../uploads/ images from the old iexcelo.com Hostinger server
 * and re-uploads them to Cloudflare R2. Rewrites all src attributes in the
 * questions and topics HTML fields to use R2 CDN URLs.
 *
 * Output: Previous Site Data.transformed.json (same structure, images on R2)
 *
 * Run from Backend/:
 *   npx ts-node src/database/migrations/scripts/transform-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const OLD_BASE_URL = 'https://iexcelo.com';
const UPLOADS_PREFIX = '../uploads/';
const R2_FOLDER = 'iexcelo/legacy';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function htmlDecode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
  };
  return types[ext] ?? 'application/octet-stream';
}

// Deterministic R2 key: 8-char hash prefix + sanitized filename
function r2Key(rawFilename: string): string {
  const hash = crypto.createHash('sha256').update(rawFilename).digest('hex').slice(0, 8);
  const safe = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${R2_FOLDER}/${hash}-${safe}`;
}

// Download URL with redirect support, returns buffer or null on failure
function download(url: string, redirectsLeft = 5): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft <= 0) { resolve(null); return; }
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(download(redirectUrl, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Check if key already exists in R2 (for idempotent re-runs)
async function r2Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(buffer: Buffer, filename: string, key: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeFromFilename(filename),
  }));
  return `${PUBLIC_URL}/${key}`;
}

// Extract all ../uploads/ src values from an HTML string
function extractSrcs(html: string): string[] {
  const srcs: string[] = [];
  const regex = /src="(\.\.\/uploads\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

// Replace src="../uploads/..." with src="R2_URL" using the url map
function rewriteHtml(html: string, urlMap: Map<string, string>): string {
  return html.replace(/src="(\.\.\/uploads\/[^"]+)"/g, (_match, src: string) => {
    const r2url = urlMap.get(src);
    return r2url ? `src="${r2url}"` : `src="${src}"`;
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const jsonPath = path.resolve(__dirname, '../../../../../Previous Site Data.json');
  const outPath = path.resolve(__dirname, '../../../../../Previous Site Data.transformed.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log('📂 Loading Previous Site Data.json...');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Array<{
    type: string;
    name: string;
    data: Record<string, any>[];
  }>;

  const tableMap = new Map<string, Record<string, any>[]>();
  for (const entry of rawData) {
    if (entry.type === 'table') tableMap.set(entry.name, entry.data);
  }

  // Fields to scan for images
  const targets = [
    { name: 'questions', fields: ['question', 'answer_description'] },
    { name: 'topics', fields: ['dcp'] },
  ];

  // Collect all unique src values across all HTML fields
  const allSrcs = new Set<string>();
  for (const { name, fields } of targets) {
    const rows = tableMap.get(name) ?? [];
    for (const row of rows) {
      for (const field of fields) {
        const val = row[field];
        if (typeof val === 'string' && val.includes(UPLOADS_PREFIX)) {
          for (const src of extractSrcs(val)) allSrcs.add(src);
        }
      }
    }
  }

  console.log(`🖼  Found ${allSrcs.size} unique ../uploads/ image references\n`);

  // Download each image and upload to R2
  const urlMap = new Map<string, string>(); // raw src → R2 public URL
  let uploaded = 0;
  let alreadyExisted = 0;
  let failed = 0;
  const failedList: string[] = [];

  for (const src of allSrcs) {
    // src may contain HTML entities (e.g. &amp;) — decode for actual filename
    const rawFilename = htmlDecode(src.replace(UPLOADS_PREFIX, ''));
    const key = r2Key(rawFilename);

    // Check R2 first — skip re-upload on re-runs
    const exists = await r2Exists(key);
    if (exists) {
      urlMap.set(src, `${PUBLIC_URL}/${key}`);
      alreadyExisted++;
      process.stdout.write(`  ⏭  Already on R2: ${rawFilename.slice(0, 50)}\n`);
      continue;
    }

    // Build download URL — encode the filename for the HTTP request
    const encodedFilename = rawFilename.split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `${OLD_BASE_URL}/uploads/${encodedFilename}`;

    process.stdout.write(`  ⬇  ${rawFilename.slice(0, 55).padEnd(55)} `);
    const buffer = await download(downloadUrl);

    if (!buffer || buffer.length === 0) {
      process.stdout.write(`❌ FAILED (skip)\n`);
      failed++;
      failedList.push(rawFilename);
      continue;
    }

    try {
      const r2url = await uploadToR2(buffer, rawFilename, key);
      urlMap.set(src, r2url);
      process.stdout.write(`✅ ${buffer.length} bytes → R2\n`);
      uploaded++;
    } catch (err: any) {
      process.stdout.write(`❌ R2 error: ${err.message}\n`);
      failed++;
      failedList.push(rawFilename);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Uploaded:      ${uploaded}`);
  console.log(`   ⏭  Already on R2: ${alreadyExisted}`);
  console.log(`   ❌ Failed:        ${failed}`);

  if (failedList.length > 0) {
    console.log(`\n⚠  Failed images (left as broken refs):`);
    for (const f of failedList) console.log(`     - ${f}`);
  }

  // Rewrite HTML fields in all tables using the URL map
  console.log(`\n✏  Rewriting HTML fields...`);
  let rewrittenFields = 0;

  for (const { name, fields } of targets) {
    const rows = tableMap.get(name) ?? [];
    for (const row of rows) {
      for (const field of fields) {
        const val = row[field];
        if (typeof val === 'string' && val.includes(UPLOADS_PREFIX)) {
          const rewritten = rewriteHtml(val, urlMap);
          if (rewritten !== val) {
            row[field] = rewritten;
            rewrittenFields++;
          }
        }
      }
    }
    console.log(`   ${name}: done`);
  }

  console.log(`   ${rewrittenFields} fields updated`);

  // Write transformed JSON
  console.log(`\n💾 Writing Previous Site Data.transformed.json...`);
  fs.writeFileSync(outPath, JSON.stringify(rawData, null, 2), 'utf-8');

  console.log(`\n✅ Done!`);
  console.log(`   ${uploaded + alreadyExisted} images on R2`);
  console.log(`   ${failed} images failed (these questions will have broken images)`);
  console.log(`   Output: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
