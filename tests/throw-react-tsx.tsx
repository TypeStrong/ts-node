// intentional whitespace to prove that sourcemaps are working.  Throw should happen on line 100.
// 100 lines is meant to be far more space than the helper functions would take.




























































































const React = { createElement: (...args: any[]) => null };
class Foo {
  constructor() {
    this.bar();
  }
  bar() { throw new Error('this is a demo'); }
  someJsx() {
    return <div />;
  }
}
new Foo();
export {};
