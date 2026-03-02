// This file causes TS to return emitSkipped because it's outside of rootDir and
// it's .js.  I assume this happens because the emit path is the same as the
// input path, and perhaps also because the file is classified "external"

const decorator = () => {};

class Foo {
  // Using a decorator to prove this .js file is getting compiled
  @decorator
  method() {
    return 'foo';
  }
}

console.log(new Foo().method());
