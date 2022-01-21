#!/usr/bin/env node

import { main } from './bin';

console.warn(
  'ts-script has been deprecated and will be removed in the next major release.',
  'Please use ts-node-script instead'
);

main(undefined, { '--scriptMode': true });
