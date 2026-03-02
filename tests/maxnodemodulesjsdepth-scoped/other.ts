// Import as values, forcing internal classification.  All files are typechecked
import { foo as a_foo, bar as a_bar } from '@scoped/a';
// Values are not used, so classification remains external.  Obeys maxNodeModulesJsDepth
import { foo as b_foo, bar as b_bar } from '@scoped/b';

// `a_bar` has type information because it has been reclassified as internal
const shouldBeBoolean2: boolean = a_bar;

// `b_bar` is missing type information, so this is not an error
const shouldBeBoolean4: boolean = null as typeof b_bar;
