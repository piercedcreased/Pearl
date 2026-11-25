// Make a new Pearl release:
//   npm run release -- 0.2.0 "Goals can link to tasks" "Faster startup"
// Sets the version, writes release-notes.md (shown in the in-app update popup),
// commits, tags v0.2.0 and pushes. GitHub Actions then builds, signs and publishes it.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [version, ...notes] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: npm run release -- <version like 0.2.0> "note one" "note two"');
  process.exit(1);
}
const run = cmd => execSync(cmd, { stdio: 'inherit' });
const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) { console.error('Commit or stash your changes first:\n' + dirty); process.exit(1); }

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const old = pkg.version;
if (version.localeCompare(old, undefined, { numeric: true }) <= 0) {
  console.error(`New version ${version} must be higher than ${old}.`); process.exit(1);
}
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync('src-tauri/Cargo.toml', cargo);

writeFileSync('release-notes.md', (notes.length ? notes : ['Fixes and improvements.']).join('\n') + '\n');

run('npm install --package-lock-only --no-audit --no-fund');
run('git add package.json package-lock.json src-tauri/Cargo.toml release-notes.md');
run(`git commit -m "Release ${version}"`);
run(`git tag v${version}`);
run('git push');
run(`git push origin v${version}`);
console.log(`\nPushed v${version}. GitHub Actions is building it now; installed copies will see it once the release is published.`);
