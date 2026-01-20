import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);

if (!match) {
  console.error('No inline <script> block found in index.html.');
  process.exit(1);
}

const scriptContent = match[1];

try {
  new Function(scriptContent);
} catch (error) {
  console.error('index.html inline script failed to parse.');
  console.error(error?.message || error);
  process.exit(1);
}

console.log('index.html inline script parsed successfully.');
