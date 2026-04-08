#!/usr/bin/env node
/**
 * Fetch last 24 hours of flows in 4-hour chunks, write NDJSON to a file.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getClient, resolveBoxGid } = require('./cli/src/api/client');

const CHUNK_HOURS = 4;
const TOTAL_HOURS = 24;
const BATCH_SIZE = 500;
const OUTPUT_FILE = path.join(__dirname, `flows_${new Date().toISOString().slice(0,10)}.ndjson`);

async function fetchChunk(client, gid, fromTs, toTs, label) {
  let cursor = null;
  let total = 0;
  const out = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

  do {
    const params = {
      gid,
      limit: BATCH_SIZE,
      query: `ts:>${fromTs} ts:<${toTs}`,
    };
    if (cursor) params.cursor = cursor;

    let data;
    let delay = 2000;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        ({ data } = await client.get('/flows', { params }));
        break;
      } catch (err) {
        if (err.response?.status === 429 && attempt < 5) {
          process.stderr.write(`[${label}] Rate limited, retrying in ${delay / 1000}s...\n`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    const results = data.results || [];
    for (const flow of results) {
      out.write(JSON.stringify(flow) + '\n');
    }
    total += results.length;
    cursor = data.next_cursor || null;

    process.stdout.write(`[${label}] fetched ${total} flows so far...\r`);
    if (cursor) await new Promise(r => setTimeout(r, 500));
  } while (cursor);

  out.end();
  return total;
}

async function main() {
  const options = {};
  const gid = await resolveBoxGid(process.env.FIREWALLA_BOX_GID, options);
  const client = getClient(options);

  const now = Math.floor(Date.now() / 1000);
  const chunks = [];
  for (let i = 0; i < TOTAL_HOURS / CHUNK_HOURS; i++) {
    const toTs = now - i * CHUNK_HOURS * 3600;
    const fromTs = toTs - CHUNK_HOURS * 3600;
    const label = `chunk ${i + 1}/6 (${CHUNK_HOURS * (i + 1) - CHUNK_HOURS}h–${CHUNK_HOURS * (i + 1)}h ago)`;
    chunks.push({ fromTs, toTs, label });
  }

  // Clear file if it exists
  fs.writeFileSync(OUTPUT_FILE, '');
  console.log(`Writing to: ${OUTPUT_FILE}\n`);

  let grandTotal = 0;
  for (const { fromTs, toTs, label } of chunks) {
    process.stdout.write(`Starting ${label}...\n`);
    const count = await fetchChunk(client, gid, fromTs, toTs, label);
    process.stdout.write(`\n[${label}] done — ${count} flows\n`);
    grandTotal += count;
  }

  console.log(`\nAll done. Total flows: ${grandTotal}`);
  console.log(`Saved to: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
