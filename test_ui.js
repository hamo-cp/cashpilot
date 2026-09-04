import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');
const dynamicSources = [
  fs.readFileSync('src/ui/components.js', 'utf8'),
  fs.readFileSync('src/pages/subscriptions.js', 'utf8'),
  fs.readFileSync('src/services/notifications.js', 'utf8'),
].join('\n');

const clicks = [...html.matchAll(/onclick="([^"]+)"/g)];
const missing = [];
for (const match of clicks) {
  const functionName = match[1].split('(')[0].trim();
  if (!functionName.startsWith('App.')) continue;
  const method = functionName.split('.')[1];
  if (!main.includes(`${method}(`) && !main.includes(`${method}:`) && !main.includes(`${method} =`)) {
    missing.push(method);
  }
}

assert.deepEqual(missing, [], `Dead App handlers: ${missing.join(', ')}`);

const allowedDynamicActions = new Set(['edit', 'delete', 'open-notification', 'delete-notification']);
const emittedActions = [...dynamicSources.matchAll(/data-app-action="([^"]+)"/g)].map(match => match[1]);
assert.ok(emittedActions.length > 0, 'Expected dynamic data actions');
assert.deepEqual(
  emittedActions.filter(action => !allowedDynamicActions.has(action)),
  [],
  'Unknown dynamic action emitted',
);

assert.equal(html.includes(['ai', 'GenerateBtn'].join('')), false);
assert.equal(main.includes(['generate', 'AIInsights'].join('')), false);

console.log(`Verified ${clicks.length} static App actions and ${emittedActions.length} inert dynamic actions.`);
