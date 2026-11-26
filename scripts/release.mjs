// Make a new Pearl release, built on this PC (the same way Windowsill does it):
//   npm run release -- 0.2.0 "what changed" "another thing"
//
// 1. bumps the version, writes release-notes.md (shown in the in-app update popup)
// 2. builds and signs the installer here with ~/.tauri/pearl.key
// 3. writes latest.json, the file installed copies check for updates
// 4. commits, tags, pushes, and uploads the release to GitHub with `gh`
//
// Nothing secret goes to GitHub: only the signed installer, its signature and latest.json.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REPO = 'piercedcreased/Pearl';
const [version, ...notes] = process.argv.slice(2);
const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', env: env || process.env });
const out = cmd => execSync(cmd).toString().trim();
const fail = msg => { console.error('\n' + msg); process.exit(1); };

if (!/^\d+\.\d+\.\d+$/.test(version || '')) fail('Usage: npm run release -- <version like 0.2.0> "note one" "note two"');
// REQUEST-TEMPLATE.md is the owner's notes file: it isn't part of the app and never gets released.
const dirty = out('git status --porcelain').split(/\r?\n/).filter(l => l && !l.endsWith('REQUEST-TEMPLATE.md')).join('\n');
if (dirty) fail('Commit or stash your changes first:\n' + dirty);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (version.localeCompare(pkg.version, undefined, { numeric: true }) <= 0) fail(`New version ${version} must be higher than ${pkg.version}.`);

const keyPath = join(homedir(), '.tauri', 'pearl.key');
if (!existsSync(keyPath)) fail(`Signing key not found at ${keyPath}. Without it, installed copies can't verify the update.`);
// Strip a byte-order mark and whitespace: either one breaks the key.
const key = readFileSync(keyPath, 'utf8').replace(/^﻿/, '').trim();

// ---- 1. version + notes ----
const noteText = (notes.length ? notes : ['Fixes and improvements.']).join('\n');
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
writeFileSync('src-tauri/Cargo.toml', readFileSync('src-tauri/Cargo.toml', 'utf8').replace(/^version = ".*"$/m, `version = "${version}"`));
writeFileSync('release-notes.md', noteText + '\n');
run('npm install --package-lock-only --no-audit --no-fund');

// ---- 2. build + sign ----
const env = {
  ...process.env,
  PATH: join(homedir(), '.cargo', 'bin') + (process.platform === 'win32' ? ';' : ':') + process.env.PATH,
  TAURI_SIGNING_PRIVATE_KEY: key,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
};
try {
  run('npx tauri build', env);
} catch {
  run('git checkout -- package.json package-lock.json src-tauri/Cargo.toml release-notes.md');
  fail('Build failed, so nothing was released and the version bump was undone.');
}

const dir = 'src-tauri/target/release/bundle/nsis';
const installer = `Pearl_${version}_x64-setup.exe`;
const sigFile = `${dir}/${installer}.sig`;
if (!existsSync(`${dir}/${installer}`) || !existsSync(sigFile)) fail(`Build finished but ${installer} or its .sig is missing.`);

// ---- 3. latest.json ----
const feed = {
  version,
  notes: noteText,
  pub_date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(sigFile, 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/${installer}`,
    },
  },
};
writeFileSync(`${dir}/latest.json`, JSON.stringify(feed, null, 2) + '\n');

// ---- 4. commit, tag, push, publish ----
run('git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock release-notes.md');
run(`git commit -m "Release ${version}"`);
run(`git tag v${version}`);
run('git push');
run(`git push origin v${version}`);
run(`gh release create v${version} "${dir}/${installer}" "${sigFile}" "${dir}/latest.json" --repo ${REPO} --title "Pearl ${version}" --notes-file release-notes.md`);

console.log(`\nPearl ${version} is out. Installed copies pick it up on their next check, or right away with Check for updates.`);
