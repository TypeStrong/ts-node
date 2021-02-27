// Import as values, forcing internal classification.  All files are typechecked
import { foo as a_foo, bar as a_bar } from '@scoped/a';
// Values are not used, so classification remains external.  Obeys maxNodeModulesJsDepth
import { foo as b_foo, bar as b_bar } from '@scoped/b';

// We must have two .ts files, one without type errors.
// Otherwise, type errors would prevent imports from executing, so external modules would not be reclassified as internal.
a_foo;

import './other';
