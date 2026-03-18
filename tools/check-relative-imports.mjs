import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SCAN_DIR = path.join(ROOT_DIR, 'src');
const IGNORE_DIRS = new Set(['vendor']);

const IMPORT_RE =
  /(?:^|\n)\s*import\s+(?:[^'"\n]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

function shouldScanDir(dirPath) {
  const name = path.basename(dirPath);
  return !IGNORE_DIRS.has(name);
}

function walkJsFiles(dirPath, result = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (shouldScanDir(fullPath)) {
        walkJsFiles(fullPath, result);
      }
      continue;
    }
    if (entry.isFile() && /\.(js|mjs)$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

function existsAsModule(resolvedBase) {
  const candidates = [
    resolvedBase,
    `${resolvedBase}.js`,
    `${resolvedBase}.mjs`,
    path.join(resolvedBase, 'index.js'),
    path.join(resolvedBase, 'index.mjs')
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function getRelativePath(filePath) {
  return toPosix(path.relative(ROOT_DIR, filePath));
}

function collectMissingImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  let match;

  while ((match = IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1];
    const resolvedBase = path.resolve(path.dirname(filePath), specifier);
    if (!existsAsModule(resolvedBase)) {
      const line = content.slice(0, match.index).split('\n').length;
      issues.push({
        file: getRelativePath(filePath),
        line,
        specifier
      });
    }
  }

  return issues;
}

function main() {
  if (!fs.existsSync(SCAN_DIR)) {
    console.error(`Scan dir not found: ${SCAN_DIR}`);
    process.exit(1);
  }

  const files = walkJsFiles(SCAN_DIR);
  const issues = files.flatMap(collectMissingImports);

  if (!issues.length) {
    console.log('Relative import check passed.');
    return;
  }

  console.log(`Found ${issues.length} missing relative imports:`);
  for (const issue of issues) {
    console.log(`${issue.file}:${issue.line} -> ${issue.specifier}`);
  }
  process.exit(1);
}

main();
