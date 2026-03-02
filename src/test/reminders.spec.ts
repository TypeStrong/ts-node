// Reminders about chores to stay up-to-date with the ecosystem

import { ts, tsSupportsStableNodeNextNode16 } from './helpers';
import { expect, test } from './testlib';

test('Detect when typescript adds new ModuleKind values; flag as a failure so we can update our code flagged [MUST_UPDATE_FOR_NEW_MODULEKIND]', async () => {
  // We have marked a few places in our code with MUST_UPDATE_FOR_NEW_MODULEKIND to make it easier to update them when TS adds new ModuleKinds
  const foundKeys: string[] = [];
  function check(value: number, name: string, required: boolean) {
    if (required) expect(ts.ModuleKind[name as any]).toBe(value);
    if (ts.ModuleKind[value] === undefined) {
      expect(ts.ModuleKind[name as any]).toBeUndefined();
    } else {
      expect(ts.ModuleKind[value]).toBe(name);
      foundKeys.push(name, `${value}`);
    }
  }
  check(0, 'None', true);
  check(1, 'CommonJS', true);
  check(2, 'AMD', true);
  check(3, 'UMD', true);
  check(4, 'System', true);
  check(5, 'ES2015', true);
  try {
    check(6, 'ES2020', false);
    check(99, 'ESNext', true);
  } catch {
    // the value changed: is `99` now, but was `6` in TS 2.7
    check(6, 'ESNext', true);
    expect(ts.ModuleKind[99]).toBeUndefined();
  }
  check(7, 'ES2022', false);
  if (tsSupportsStableNodeNextNode16) {
    check(100, 'Node16', true);
  } else {
    check(100, 'Node12', false);
  }
  check(199, 'NodeNext', false);
  const actualKeys = Object.keys(ts.ModuleKind);
  actualKeys.sort();
  foundKeys.sort();
  expect(actualKeys).toEqual(foundKeys);
});
