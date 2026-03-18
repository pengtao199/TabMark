import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const configPath = path.join(rootDir, 'tools', 'file-size-rules.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = new Set(process.argv.slice(2));
const reportOnly = args.has('--report');

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function countLines(text) {
  if (text.length === 0) return 0;
  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith('\n') ? newlineCount : newlineCount + 1;
}

function getRuleForFile(relPath) {
  const override = config.overrides?.[relPath] || {};
  return {
    min: Number.isInteger(override.min) ? override.min : config.default.min,
    max: Number.isInteger(override.max) ? override.max : config.default.max
  };
}

const includeExts = new Set(config.includeExtensions || ['.js']);
const includeRoots = config.includeRoots || ['src'];
const excludes = new Set((config.exclude || []).map(normalize));

const allFiles = includeRoots.flatMap((root) => {
  const absRoot = path.join(rootDir, root);
  if (!fs.existsSync(absRoot)) return [];
  return walk(absRoot);
});

const scanned = [];
for (const file of allFiles) {
  const relPath = normalize(path.relative(rootDir, file));
  const ext = path.extname(relPath);

  if (!includeExts.has(ext)) continue;
  if (excludes.has(relPath)) continue;

  const text = fs.readFileSync(file, 'utf8');
  const lines = countLines(text);
  const rule = getRuleForFile(relPath);

  scanned.push({ relPath, lines, min: rule.min, max: rule.max });
}

scanned.sort((a, b) => b.lines - a.lines);

const violations = scanned.filter((f) => f.lines < f.min || f.lines > f.max);

console.log('File Size Rules');
console.log(`Default: min=${config.default.min}, max=${config.default.max}`);
console.log(`Target : min=${config.target.min}, max=${config.target.max}`);
console.log('');

for (const file of scanned) {
  const status = file.lines < file.min || file.lines > file.max ? 'VIOLATION' : 'OK';
  console.log(`${status.padEnd(9)} ${String(file.lines).padStart(5)}  ${file.relPath}  [${file.min}-${file.max}]`);
}

console.log('');
console.log(`Scanned: ${scanned.length} files`);
console.log(`Violations: ${violations.length}`);

if (!reportOnly && violations.length > 0) {
  process.exitCode = 1;
}
