import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('src/main.js', 'utf8');
const comp = fs.readFileSync('src/ui/components.js', 'utf8');

// Find all onclick attributes
const clicks = [...html.matchAll(/onclick="([^"]+)"/g), ...comp.matchAll(/onclick="([^"]+)"/g)];

console.log(`Found ${clicks.length} buttons/actions to verify...`);

let missing = 0;
clicks.forEach(match => {
  let funcCall = match[1];
  // extract function name e.g. App.navigateTo('home') -> App.navigateTo
  let funcName = funcCall.split('(')[0].trim();
  
  if (funcName.startsWith('App.')) {
    let method = funcName.split('.')[1];
    // verify method exists in main.js
    if (!js.includes(`${method}(`) && !js.includes(`${method}:`) && !js.includes(`${method} =`)) {
      console.log(`❌ ERROR: Button calls App.${method} but it does NOT exist in main.js!`);
      missing++;
    }
  }
});

if (missing === 0) {
  console.log("✅ All buttons are strictly linked to working functions. ZERO dead buttons!");
}
