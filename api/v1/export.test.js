// Run with: node api/v1/export.test.js

function maxWeight(str) {
  if (!str) return 0;
  return Math.max(0, ...String(str).split(/[,\/\s]+/).map(v => parseFloat(v) || 0));
}

let passed = 0, failed = 0;
function assert(desc, actual, expected) {
  if (actual === expected) {
    console.log('  ✓', desc);
    passed++;
  } else {
    console.error('  ✗', desc, `— expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log('maxWeight()');
assert('comma-separated warm-up + working sets', maxWeight('135,175,185,195'), 195);
assert('squat progression 135→205',              maxWeight('135,185,205'),      205);
assert('single value',                           maxWeight('225'),              225);
assert('slash-separated',                        maxWeight('135/185'),          185);
assert('space-separated',                        maxWeight('135 185 225'),      225);
assert('null returns 0',                         maxWeight(null),               0);
assert('empty string returns 0',                 maxWeight(''),                 0);
assert('non-numeric string returns 0',           maxWeight('bodyweight'),       0);
assert('trailing comma ignored',                 maxWeight('135,175,'),         175);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
