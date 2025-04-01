const fs = require('fs');
const path = require('path');

// Get current commit hash (if in Git repo)
const { execSync } = require('child_process');
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const buildTime = new Date().toISOString();

// Read the index.html file
const indexPath = path.resolve('static/index.html');
const html = fs.readFileSync(indexPath, 'utf-8');

// Replace the build info placeholder
const newHtml = html.replace(
  /Build: DEV/,
  `Build: ${commitHash} (${buildTime})`
);

// Write back the modified content
fs.writeFileSync(indexPath, newHtml, 'utf-8');