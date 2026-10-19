#!/usr/bin/env node
/*
 * Replace the placeholder base URL in every .html, .xml and .txt file.
 *
 *   node scripts/set-base-url.js https://yourname.github.io/studykit-tools
 *   node scripts/set-base-url.js https://www.your-domain.com
 *
 * No trailing slash. Run it once; review the changes with `git diff` before committing.
 * It replaces the current value stored in scripts/base-url.txt, so you can run it again
 * later to move to a new address (for example when you buy a custom domain).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stateFile = path.join(__dirname, 'base-url.txt');
const from = fs.readFileSync(stateFile, 'utf8').trim();
const to = (process.argv[2] || '').trim().replace(/\/+$/, '');

if (!/^https:\/\/[a-z0-9.-]+(\/[A-Za-z0-9._~-]+)*$/i.test(to)) {
  console.error('Usage: node scripts/set-base-url.js https://your-domain.com  (https, no trailing slash)');
  process.exit(1);
}
if (from === to) { console.log('Base URL is already ' + to); process.exit(0); }

let changedFiles = 0;
let replacements = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'tests', 'scripts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(html|xml|txt)$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const parts = text.split(from);
    if (parts.length > 1) {
      fs.writeFileSync(full, parts.join(to));
      changedFiles++;
      replacements += parts.length - 1;
    }
  }
})(root);
fs.writeFileSync(stateFile, to + '\n');
console.log(`Replaced ${replacements} occurrence(s) of ${from} with ${to} in ${changedFiles} file(s).`);
