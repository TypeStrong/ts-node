import { foo, bar } from 'external';

// `foo` has type information so this is an error
const shouldBeBoolean: boolean = foo;

// `bar` is missing type information, so this is not an error
const shouldBeBoolean2: boolean = bar;
