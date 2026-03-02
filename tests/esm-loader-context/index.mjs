import * as moduleA from './moduleA.mjs';
import * as moduleB from './moduleB.mjs' assert { foo: 'bar' };
import * as jsonModule from './jsonModuleA.json' assert { type: 'json' };

await import('./moduleC.mjs');
await import('./moduleD.mjs', { foo: 'bar' });
await import('./jsonModuleB.json', { assert: { type: 'json' } });
