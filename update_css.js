const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'style.css');
let css = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { search: /margin-left:/g, replace: 'margin-inline-start:' },
  { search: /margin-right:/g, replace: 'margin-inline-end:' },
  { search: /padding-left:/g, replace: 'padding-inline-start:' },
  { search: /padding-right:/g, replace: 'padding-inline-end:' },
  { search: /border-left:/g, replace: 'border-inline-start:' },
  { search: /border-right:/g, replace: 'border-inline-end:' },
  { search: /border-left-color:/g, replace: 'border-inline-start-color:' },
  { search: /border-right-color:/g, replace: 'border-inline-end-color:' },
  { search: /border-top-left-radius:/g, replace: 'border-start-start-radius:' },
  { search: /border-top-right-radius:/g, replace: 'border-start-end-radius:' },
  { search: /border-bottom-left-radius:/g, replace: 'border-end-start-radius:' },
  { search: /border-bottom-right-radius:/g, replace: 'border-end-end-radius:' },
  { search: /text-align:\s*left/g, replace: 'text-align: start' },
  { search: /text-align:\s*right/g, replace: 'text-align: end' },
];

replacements.forEach(r => {
  css = css.replace(r.search, r.replace);
});

// For absolute positioning, left/right is harder. But let's add rules for [dir="ltr"] if needed.
// E.g., .floating-add-btn is usually in corner.
// We can just add a global flip for icons if needed.
css += `
/* RTL/LTR specific flips */
[dir="ltr"] .more-nav-arrow,
[dir="ltr"] .modal-close {
  transform: scaleX(-1);
}
`;

fs.writeFileSync(filePath, css, 'utf8');
console.log('CSS updated successfully');
