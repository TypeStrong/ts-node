import { Logger } from 'tslog';
new Logger().info('hi');
console.log(require.resolve('source-map-support') === require.resolve('@cspotcode/source-map-support'));
console.log(require.resolve('source-map-support/register') === require.resolve('@cspotcode/source-map-support/register'));
/*
tslog uses `require('source-map-support').wrapCallSite` directly.
Without redirection to @cspotcode/source-map-support it does not have access to the sourcemap information we provide.
*/
interface Foo {

























































































}
console.log(new Error().stack!.split('\n')[1]);
new Logger().info('hi');
