import { URL } from 'url';
import type { CreateOptions } from '../..';

// Duplicated in loader.mjs
const protocol = 'testloader://';
const clearLoaderCmd = 'clearLoader';
const setLoaderCmd = 'setLoader';

// Avoid ts compiler transforming import() into require().
const doImport = new Function('specifier', 'return import(specifier)');
let cacheBust = 0;
async function call(url: URL) {
  url.searchParams.set('cacheBust', `${cacheBust++}`);
  await doImport(url.toString());
}

export async function clearLoader() {
  await call(new URL(`${protocol}${clearLoaderCmd}`));
}

export async function setLoader(specifier: string, options: CreateOptions | undefined) {
  const url = new URL(`${protocol}${setLoaderCmd}`);
  url.searchParams.append('specifier', specifier);
  url.searchParams.append('options', JSON.stringify(options));
  await call(url);
}
