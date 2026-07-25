const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git')) {
        results = results.concat(walkDir(file));
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.html')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, '..'));
const arabicRegex = /[\u0600-\u06FF]+/;

files.forEach(file => {
  if (file.includes('i18n.js') || file.includes('constants.js')) return; // Ignore definitions
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (arabicRegex.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*')) {
      console.log(`${path.basename(file)}:${i+1}: ${line.trim()}`);
    }
  });
});
