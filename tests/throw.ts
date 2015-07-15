class Foo {
  constructor () { this.bar() }
  bar () { throw new Error('this is a demo') }
}
new Foo()
