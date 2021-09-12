// intentional whitespace to prove that sourcemaps are working.  Throw should happen on line 100.
// 100 lines is meant to be far more space than the helper functions would take.

// Space in filename is intentional to ensure we handle this correctly when providing sourcemaps



























































































class Foo {
  constructor() {
    this.bar();
  }
  bar() { throw new Error('this is a demo'); }
}
new Foo();
export {};
