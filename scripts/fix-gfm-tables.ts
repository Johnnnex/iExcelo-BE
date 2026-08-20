/**
 * scripts/fix-gfm-tables.ts
 *
 * Converts GFM pipe-table syntax in stored Markdown content to raw HTML tables.
 *
 * WHY:
 *   tiptap-markdown serialises TipTap Table nodes as GFM pipe tables. GFM pipe
 *   tables cannot represent multi-paragraph cell content — any paragraph break
 *   inside a cell is collapsed to a space on save. The editor fix stores tables as
 *   inline HTML instead; RichText.tsx (rehypeRaw) renders them fine either way.
 *
 * WHAT THIS FIXES:
 *   Records where a text column contains valid GFM tables → converts those tables
 *   to <table>…</table> HTML so the updated editor round-trips them correctly.
 *
 * WHAT THIS CANNOT FIX:
 *   Content that was already corrupted (multi-paragraph cells collapsed to spaces)
 *   is NOT restored — that data is gone. You will need to re-enter those cells
 *   manually. This script only fixes the storage format going forward.
 *
 * USAGE:
 *   # 1. Preview only — shows what would change, writes nothing:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.migrate.json scripts/fix-gfm-tables.ts
 *
 *   # 2. Apply changes:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.migrate.json scripts/fix-gfm-tables.ts --apply
 *
 * Run from the Backend/ directory.
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

// ─── GFM → HTML conversion ────────────────────────────────────────────────────

// Matches a full GFM pipe table: header row + separator row + one or more data rows.
// Uses \n (not \r\n) since JS string storage normalises line endings.
const GFM_TABLE_RE = /^\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*/gm;

function parseCells(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

type Align = 'left' | 'right' | 'center' | null;

function parseAlignments(separatorRow: string): Align[] {
  return separatorRow.split('|').slice(1, -1).map((c) => {
    const t = c.trim();
    if (t.startsWith(':') && t.endsWith(':')) return 'center';
    if (t.endsWith(':')) return 'right';
    if (t.startsWith(':')) return 'left';
    return null;
  });
}

function gfmTableToHtml(gfm: string): string {
  const lines = gfm.trimEnd().split('\n');
  if (lines.length < 3) return gfm; // need header + separator + ≥1 data row

  const headers = parseCells(lines[0]);
  const aligns = parseAlignments(lines[1]);
  const dataLines = lines.slice(2).filter((l) => l.trim());

  const styleAttr = (i: number) =>
    aligns[i] ? ` style="text-align:${aligns[i]}"` : '';

  let html = '<table>\n<thead>\n<tr>';
  headers.forEach((h, i) => {
    html += `<th${styleAttr(i)}>${h}</th>`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';

  dataLines.forEach((line) => {
    const cells = parseCells(line);
    html += '<tr>';
    cells.forEach((cell, i) => {
      html += `<td${styleAttr(i)}>${cell}</td>`;
    });
    html += '</tr>\n';
  });

  html += '</tbody>\n</table>';
  return html;
}

/**
 * Replace every GFM pipe table in `text` with its HTML equivalent.
 * Returns { result, count } where count is how many tables were replaced.
 */
function convertGfmTables(text: string): { result: string; count: number } {
  let count = 0;
  const result = text.replace(GFM_TABLE_RE, (match) => {
    count++;
    return `\n${gfmTableToHtml(match)}\n`;
  });
  return { result, count };
}

// ─── Scan targets ─────────────────────────────────────────────────────────────

interface Target {
  /** Postgres table name */
  table: string;
  /** Primary key column */
  pk: string;
  /** Text columns to scan */
  cols: string[];
}

const TARGETS: Target[] = [
  {
    table: 'questions',
    pk: 'id',
    cols: ['questionText', 'explanation'],
  },
  {
    table: 'topics',
    pk: 'id',
    cols: ['content'],
  },
  {
    table: 'passages',
    pk: 'id',
    cols: ['content'],
  },
  {
    table: 'bulk_email_campaigns',
    pk: 'id',
    // Only process drafts — sent campaigns are already dispatched
    cols: ['content'],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'iexcelo',
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  });

  await client.connect();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' fix-gfm-tables  ' + (APPLY ? '⚡ APPLY MODE' : '🔍 DRY RUN (pass --apply to write)'));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let totalRows = 0;
  const updates: Array<{ table: string; pkCol: string; pkVal: string; col: string; newVal: string }> = [];

  for (const target of TARGETS) {
    for (const col of target.cols) {
      // Pre-filter: only fetch rows whose column contains the GFM separator row pattern.
      // The POSIX regex \|[-: |]+\| matches |---|---| style separators.
      const { rows } = await client.query(
        `SELECT "${target.pk}", "${col}"
         FROM   "${target.table}"
         WHERE  "${col}" IS NOT NULL
           AND  "${col}" ~ '\\|[-: |]+\\|'`,
      );

      if (!rows.length) {
        console.log(`  ${target.table}.${col}: no candidates`);
        continue;
      }

      let hits = 0;
      for (const row of rows) {
        const original: string = row[col] ?? '';
        const { result, count } = convertGfmTables(original);

        if (!count || result === original) continue;

        hits++;
        totalRows++;
        console.log(`  ${target.table}.${col} [${row[target.pk]}]: ${count} table(s)`);

        // Show first 120 chars of each changed section for review
        const originalSnippet = original.slice(0, 120).replace(/\n/g, '↵');
        const resultSnippet = result.slice(0, 120).replace(/\n/g, '↵');
        console.log(`    before: ${originalSnippet}`);
        console.log(`    after:  ${resultSnippet}`);

        if (APPLY) {
          updates.push({
            table: target.table,
            pkCol: target.pk,
            pkVal: row[target.pk],
            col,
            newVal: result,
          });
        }
      }

      if (!hits) {
        console.log(`  ${target.table}.${col}: ${rows.length} candidate(s) scanned — 0 with GFM tables`);
      }
    }
  }

  console.log('');

  if (!APPLY) {
    console.log(`DRY RUN complete.  ${totalRows} row(s) would be updated.`);
    console.log('Run with --apply to write changes.');
  } else if (!updates.length) {
    console.log('Nothing to update — all records already use HTML tables or have no tables.');
  } else {
    // Apply all updates in a single transaction
    await client.query('BEGIN');
    try {
      for (const u of updates) {
        await client.query(
          `UPDATE "${u.table}" SET "${u.col}" = $1 WHERE "${u.pkCol}" = $2`,
          [u.newVal, u.pkVal],
        );
      }
      await client.query('COMMIT');
      console.log(`✅  ${updates.length} row(s) updated successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌  Error during update — transaction rolled back.', err);
      process.exit(1);
    }
  }

  console.log('');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
