import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rulesPath = path.join(rootDir, 'tools', 'file-size-rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const args = new Set(process.argv.slice(2));
const outputJson = args.has('--json');

function normalize(p) {
  return p.replace(/\\/g, '/');
}

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

function countLines(text) {
  if (!text) return 0;
  const nl = (text.match(/\n/g) || []).length;
  return text.endsWith('\n') ? nl : nl + 1;
}

function getLineRule(relPath) {
  const override = rules.overrides?.[relPath] || {};
  return {
    min: Number.isInteger(override.min) ? override.min : rules.default.min,
    max: Number.isInteger(override.max) ? override.max : rules.default.max
  };
}

function estimateChunks(lines, targetMin = 200, targetMax = 500) {
  if (lines <= targetMax) return 1;
  const minChunks = Math.ceil(lines / targetMax);
  const maxChunks = Math.max(minChunks, Math.floor(lines / targetMin));
  const chunkCount = minChunks;
  const idealSize = Math.ceil(lines / chunkCount);
  return {
    chunkCount,
    idealSize,
    minChunks,
    maxChunks
  };
}

const includeRoots = rules.includeRoots || ['src'];
const includeExts = new Set(rules.includeExtensions || ['.js']);
const exclude = new Set((rules.exclude || []).map(normalize));
const targetMin = rules.target?.min ?? 200;
const targetMax = rules.target?.max ?? 500;

const allFiles = includeRoots.flatMap((root) => {
  const absRoot = path.join(rootDir, root);
  if (!fs.existsSync(absRoot)) return [];
  return walk(absRoot);
});

const rows = [];
for (const file of allFiles) {
  const relPath = normalize(path.relative(rootDir, file));
  if (exclude.has(relPath)) continue;
  if (!includeExts.has(path.extname(relPath))) continue;

  const text = fs.readFileSync(file, 'utf8');
  const lines = countLines(text);
  const effectiveRule = getLineRule(relPath);
  const aboveTarget = lines > targetMax;
  const suggestion = estimateChunks(lines, targetMin, targetMax);

  rows.push({
    file: relPath,
    lines,
    effectiveMin: effectiveRule.min,
    effectiveMax: effectiveRule.max,
    aboveTarget,
    suggestedChunks: suggestion.chunkCount,
    suggestedChunkSize: suggestion.idealSize
  });
}

rows.sort((a, b) => b.lines - a.lines);

const oversized = rows.filter((r) => r.aboveTarget);

if (outputJson) {
  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    targetRange: { min: targetMin, max: targetMax },
    oversizedCount: oversized.length,
    oversized
  }, null, 2)}\n`);
  process.exit(0);
}

console.log('Split Audit Report');
console.log(`Target: ${targetMin}-${targetMax} lines per file`);
console.log('');

if (oversized.length === 0) {
  console.log('No files above target max.');
  process.exit(0);
}

for (const row of oversized) {
  console.log(
    `${String(row.lines).padStart(5)}  ${row.file}  -> chunks=${row.suggestedChunks}, each~${row.suggestedChunkSize} lines`
  );
}

console.log('');
console.log(`Oversized files: ${oversized.length}`);
