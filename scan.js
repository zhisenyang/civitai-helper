#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function main() {
  const [rootArg = '.', outputArg = 'scan-results.txt'] = process.argv.slice(2);
  const rootDir = path.resolve(process.cwd(), rootArg);
  const outputFile = path.resolve(process.cwd(), outputArg);

  const rootStat = await safeStat(rootDir);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Root path is not a directory: ${rootDir}`);
  }

  const files = [];
  await collectFiles(rootDir, rootDir, files, outputFile);

  const content = files.length > 0 ? `${files.join('\n')}\n` : '';
  await fs.promises.writeFile(outputFile, content, 'utf8');

  console.log(`Collected ${files.length} file(s).`);
  console.log(`Output saved to ${outputFile}`);
}

async function collectFiles(currentDir, rootDir, collection, outputFile) {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (path.resolve(absolutePath) === outputFile) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFiles(absolutePath, rootDir, collection, outputFile);
      continue;
    }

    if (entry.isFile()) {
      collection.push(path.relative(rootDir, absolutePath) || entry.name);
      continue;
    }
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.promises.stat(targetPath);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
