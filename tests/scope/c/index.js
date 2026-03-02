let failures = 0;
try {
  // This should fail with an error because it is outside scopedir
  require('./scopedir/index');
  failures++;
} catch (e) {
  // good
}

try {
  // This should fail with an error because it is outside scopedir
  require('./config/index');
  failures++;
} catch (e) {
  // good
}

try {
  // this should succeed
  console.log(require('./config/scopedir/index').a);
} catch (e) {
  // bad
  failures++;
}

console.log(`Failures: ${failures}`);
