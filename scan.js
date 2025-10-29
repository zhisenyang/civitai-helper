#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

async function main() {
  const { rootArg, deepScan, outputArg } = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), rootArg);
  const outputFile = path.resolve(process.cwd(), outputArg);

  const rootStat = await safeStat(rootDir);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Root path is not a directory: ${rootDir}`);
  }

  const files = [];
  await collectFiles(rootDir, files, outputFile, deepScan);

  const content = files.length > 0 ? `${files.join("\n")}\n` : "";
  await fs.promises.writeFile(outputFile, content, "utf8");

  console.log(`Collected ${files.length} file(s).`);
  console.log(`Output saved to ${outputFile}`);
}

async function collectFiles(currentDir, collection, outputFile, deepScan) {
  const entries = await fs.promises.readdir(currentDir, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (path.resolve(absolutePath) === outputFile) {
      continue;
    }

    if (entry.isDirectory()) {
      if (deepScan) {
        await collectFiles(absolutePath, collection, outputFile, deepScan);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const { name: baseName, ext } = path.parse(entry.name);
    if (!ext || !/^\d+$/.test(baseName)) {
      continue;
    }

    collection.push(entry.name);
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.promises.stat(targetPath);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return null;
    }
    throw error;
  }
}

function parseArgs(args) {
  let rootArg;
  let outputArg;
  let shallow = false;

  for (const arg of args) {
    if (isShallowFlag(arg)) {
      shallow = true;
      continue;
    }

    if (!rootArg) {
      rootArg = arg;
      continue;
    }

    if (!outputArg) {
      outputArg = arg;
      continue;
    }
  }

  return {
    rootArg: rootArg || ".",
    outputArg: outputArg || "scan-results.txt",
    deepScan: !shallow,
  };
}

function isShallowFlag(value) {
  return value === "--flat" || value === "--shallow" || value === "--top";
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
