async function main() {
  const fooModule = await import('./foo.ts');
  console.dir({foo: fooModule})
}
main()
