#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = 'merged.xml';

// Function to escape XML entities
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}

// Function to check if a file is ignored by .gitignore
function isIgnored(filePath) {
  try {
    execSync(`git check-ignore --quiet "${filePath}"`, { stdio: 'ignore' });
    return true; // Ignored
  } catch (error) {
    return false; // Not ignored or git isn't available
  }
}

// Function to process a file
function processFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const escapedContent = escapeXml(content);
    const relativePath = path.relative(process.cwd(), filePath);

    return `
  <file path="${relativePath}">
    <name>${path.basename(filePath)}</name>
    <size>${stats.size}</size>
    <modified>${stats.mtime.toISOString()}</modified>
    <content>
      ${escapedContent}
    </content>
  </file>`;
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error}`);
    return ''; // Return empty string to avoid breaking the merge
  }
}


// Function to recursively get files
function getFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) { // Ignore hidden directories
          traverse(fullPath);
        }
      } else {
        if (!entry.name.startsWith('.') && !isIgnored(fullPath)) { // Ignore hidden files and git ignored files
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}


// Main function
function main() {
  const files = getFiles('.');

  let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<merged_files>\n';

  for (const file of files) {
    xmlContent += processFile(file);
  }

  xmlContent += '\n</merged_files>';

  fs.writeFileSync(OUTPUT_FILE, xmlContent);
  console.log(`Successfully merged files into ${OUTPUT_FILE}`);
}


main();