import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function findFunctionRange(source, functionName) {
  const pattern = new RegExp(`(^|\\n)function\\s+${functionName}\\s*\\(`, 'm');
  const match = pattern.exec(source);
  if (!match) return null;

  const start = match.index + (match[1] ? match[1].length : 0);
  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;

  while (end < source.length && (source[end] === '\n' || source[end] === '\r')) {
    end += 1;
  }

  return { start, end, code: source.slice(start, end) };
}

function insertImport(source, importLine) {
  if (source.includes(importLine)) return source;
  let offset = 0;
  while (offset < source.length) {
    if (!source.startsWith('import ', offset)) break;
    const endOfImport = source.indexOf(';', offset);
    if (endOfImport === -1) break;
    offset = endOfImport + 1;
    if (source[offset] === '\r') offset += 1;
    if (source[offset] === '\n') offset += 1;
  }
  return `${source.slice(0, offset)}${importLine}\n${source.slice(offset)}`;
}

const args = parseArgs(process.argv.slice(2));
const sourceFile = args.source;
const targetFile = args.target;
const names = String(args.functions || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const importLine = args.importLine ? String(args.importLine) : '';

if (!sourceFile || !targetFile || names.length === 0) {
  console.error('Usage: node tools/extract-functions.mjs --source <file> --target <file> --functions a,b [--importLine "..."]');
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), sourceFile);
const targetPath = path.resolve(process.cwd(), targetFile);

let source = fs.readFileSync(sourcePath, 'utf8');
const extracted = [];

for (const fn of names) {
  const range = findFunctionRange(source, fn);
  if (!range) {
    console.error(`Function not found: ${fn}`);
    continue;
  }
  extracted.push(range.code.replace(/^function\s+/m, 'export function '));
  source = `${source.slice(0, range.start)}${source.slice(range.end)}`;
}

if (extracted.length === 0) {
  console.error('No functions extracted.');
  process.exit(1);
}

if (importLine) {
  source = insertImport(source, importLine);
}

let targetContent = '';
if (fs.existsSync(targetPath)) {
  targetContent = fs.readFileSync(targetPath, 'utf8').trimEnd();
  targetContent += '\n\n';
}
targetContent += extracted.join('\n\n').trimEnd();
targetContent += '\n';

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, targetContent, 'utf8');
fs.writeFileSync(sourcePath, source, 'utf8');

console.log(`Extracted ${extracted.length} function(s) to ${targetFile}`);
