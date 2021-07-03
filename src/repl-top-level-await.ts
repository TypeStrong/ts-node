// Based on https://github.com/nodejs/node/blob/975bbbc443c47df777d460fadaada3c6d265b321/lib/internal/repl/await.js
import { Node, Parser } from 'acorn';
import { base, recursive, RecursiveWalkerFn, WalkerCallback } from 'acorn-walk';
import { Recoverable } from 'repl';

const walk = {
  base,
  recursive,
};

function isTopLevelDeclaration(state: State) {
  return state.ancestors[state.ancestors.length - 2] === state.body;
}

const noop: NOOP = () => {};
const visitorsWithoutAncestors: VisitorsWithoutAncestors = {
  ClassDeclaration(node, state, c) {
    if (isTopLevelDeclaration(state)) {
      state.prepend(node, `${node.id.name}=`);
      state.hoistedDeclarationStatements.push(`let ${node.id.name}; `);
    }

    walk.base.ClassDeclaration(node, state, c);
  },
  ForOfStatement(node, state, c) {
    if (node.await === true) {
      state.containsAwait = true;
    }
    walk.base.ForOfStatement(node, state, c);
  },
  FunctionDeclaration(node, state, c) {
    state.prepend(node, `${node.id.name}=`);
    state.hoistedDeclarationStatements.push(`var ${node.id.name}; `);
  },
  FunctionExpression: noop,
  ArrowFunctionExpression: noop,
  MethodDefinition: noop,
  AwaitExpression(node, state, c) {
    state.containsAwait = true;
    walk.base.AwaitExpression(node, state, c);
  },
  ReturnStatement(node, state, c) {
    state.containsReturn = true;
    walk.base.ReturnStatement(node, state, c);
  },
  VariableDeclaration(node, state, c) {
    const variableKind = node.kind;
    const isIterableForDeclaration = [
      'ForOfStatement',
      'ForInStatement',
    ].includes(state.ancestors[state.ancestors.length - 2].type);

    if (variableKind === 'var' || isTopLevelDeclaration(state)) {
      state.replace(
        node.start,
        node.start + variableKind.length + (isIterableForDeclaration ? 1 : 0),
        variableKind === 'var' && isIterableForDeclaration
          ? ''
          : 'void' + (node.declarations.length === 1 ? '' : ' (')
      );

      if (!isIterableForDeclaration) {
        node.declarations.forEach((decl) => {
          state.prepend(decl, '(');
          state.append(decl, decl.init ? ')' : '=undefined)');
        });

        if (node.declarations.length !== 1) {
          state.append(node.declarations[node.declarations.length - 1], ')');
        }
      }

      const variableIdentifiersToHoist: [
        ['var', string[]],
        ['let', string[]]
      ] = [
        ['var', []],
        ['let', []],
      ];

      function registerVariableDeclarationIdentifiers(node: BaseNode) {
        switch (node.type) {
          case 'Identifier':
            variableIdentifiersToHoist[variableKind === 'var' ? 0 : 1][1].push(
              node.name
            );
            break;
          case 'ObjectPattern':
            node.properties.forEach((property) => {
              registerVariableDeclarationIdentifiers(property.value);
            });
            break;
          case 'ArrayPattern':
            node.elements.forEach((element) => {
              registerVariableDeclarationIdentifiers(element);
            });
            break;
        }
      }

      node.declarations.forEach((decl) => {
        registerVariableDeclarationIdentifiers(decl.id);
      });

      variableIdentifiersToHoist.forEach(({ 0: kind, 1: identifiers }) => {
        if (identifiers.length > 0) {
          state.hoistedDeclarationStatements.push(
            `${kind} ${identifiers.join(', ')}; `
          );
        }
      });
    }

    walk.base.VariableDeclaration(node, state, c);
  },
};

const visitors: Record<string, RecursiveWalkerFn<State>> = {};
for (const nodeType of Object.keys(walk.base)) {
  const callback =
    (visitorsWithoutAncestors[nodeType as keyof VisitorsWithoutAncestors] as
      | VisitorsWithoutAncestorsFunction
      | undefined) || walk.base[nodeType];

  visitors[nodeType] = (node, state, c) => {
    const isNew = node !== state.ancestors[state.ancestors.length - 1];
    if (isNew) {
      state.ancestors.push(node);
    }
    callback(node as CustomRecursiveWalkerNode, state, c);
    if (isNew) {
      state.ancestors.pop();
    }
  };
}

export function processTopLevelAwait(src: string) {
  const wrapPrefix = '(async () => { ';
  const wrapped = `${wrapPrefix}${src} })()`;
  const wrappedArray = Array.from(wrapped);
  let root;
  try {
    root = Parser.parse(wrapped, { ecmaVersion: 'latest' }) as RootNode;
  } catch (e) {
    if (e.message.startsWith('Unterminated ')) throw new Recoverable(e);
    // If the parse error is before the first "await", then use the execution
    // error. Otherwise we must emit this parse error, making it look like a
    // proper syntax error.
    const awaitPos = src.indexOf('await');
    const errPos = e.pos - wrapPrefix.length;
    if (awaitPos > errPos) return null;
    // Convert keyword parse errors on await into their original errors when
    // possible.
    if (
      errPos === awaitPos + 6 &&
      e.message.includes('Expecting Unicode escape sequence')
    )
      return null;
    if (errPos === awaitPos + 7 && e.message.includes('Unexpected token'))
      return null;
    const line = e.loc.line;
    const column = line === 1 ? e.loc.column - wrapPrefix.length : e.loc.column;
    let message =
      '\n' +
      src.split('\n')[line - 1] +
      '\n' +
      ' '.repeat(column) +
      '^\n\n' +
      e.message.replace(/ \([^)]+\)/, '');
    // V8 unexpected token errors include the token string.
    if (message.endsWith('Unexpected token'))
      message += " '" + src[e.pos - wrapPrefix.length] + "'";
    // eslint-disable-next-line no-restricted-syntax
    throw new SyntaxError(message);
  }
  const body = root.body[0].expression.callee.body;
  const state: State = {
    body,
    ancestors: [],
    hoistedDeclarationStatements: [],
    replace(from, to, str) {
      for (let i = from; i < to; i++) {
        wrappedArray[i] = '';
      }
      if (from === to) str += wrappedArray[from];
      wrappedArray[from] = str;
    },
    prepend(node, str) {
      wrappedArray[node.start] = str + wrappedArray[node.start];
    },
    append(node, str) {
      wrappedArray[node.end - 1] += str;
    },
    containsAwait: false,
    containsReturn: false,
  };

  walk.recursive(body, state, visitors);

  // Do not transform if
  // 1. False alarm: there isn't actually an await expression.
  // 2. There is a top-level return, which is not allowed.
  if (!state.containsAwait || state.containsReturn) {
    return null;
  }

  const last = body.body[body.body.length - 1];
  if (last.type === 'ExpressionStatement') {
    // For an expression statement of the form
    // ( expr ) ;
    // ^^^^^^^^^^   // last
    //   ^^^^       // last.expression
    //
    // We do not want the left parenthesis before the `return` keyword;
    // therefore we prepend the `return (` to `last`.
    //
    // On the other hand, we do not want the right parenthesis after the
    // semicolon. Since there can only be more right parentheses between
    // last.expression.end and the semicolon, appending one more to
    // last.expression should be fine.
    state.prepend(last, 'return (');
    state.append(last.expression, ')');
  }

  return state.hoistedDeclarationStatements.join('') + wrappedArray.join('');
}

type CustomNode<T> = Node & T;
type RootNode = CustomNode<{
  body: Array<
    CustomNode<{
      expression: CustomNode<{
        callee: CustomNode<{
          body: CustomNode<{
            body: Array<CustomNode<{ expression: Node }>>;
          }>;
        }>;
      }>;
    }>
  >;
}>;
type CommonVisitorMethodNode = CustomNode<{ id: CustomNode<{ name: string }> }>;
type ForOfStatementNode = CustomNode<{ await: boolean }>;
type VariableDeclarationNode = CustomNode<{
  kind: 'var' | 'let' | 'const';
  declarations: VariableDeclaratorNode[];
}>;

type IdentifierNode = CustomNode<{ type: 'Identifier'; name: string }>;
type ObjectPatternNode = CustomNode<{
  type: 'ObjectPattern';
  properties: Array<PropertyNode>;
}>;
type ArrayPatternNode = CustomNode<{
  type: 'ArrayPattern';
  elements: Array<BaseNode>;
}>;
type PropertyNode = CustomNode<{
  type: 'Property';
  method: boolean;
  shorthand: boolean;
  computed: boolean;
  key: BaseNode;
  kind: string;
  value: BaseNode;
}>;
type BaseNode = IdentifierNode | ObjectPatternNode | ArrayPatternNode;
type VariableDeclaratorNode = CustomNode<{ id: BaseNode; init: Node }>;

interface State {
  body: Node;
  ancestors: Node[];
  hoistedDeclarationStatements: string[];
  replace: (from: number, to: number, str: string) => void;
  prepend: (node: Node, str: string) => void;
  append: (from: Node, str: string) => void;
  containsAwait: boolean;
  containsReturn: boolean;
}

type NOOP = () => void;

type VisitorsWithoutAncestors = {
  ClassDeclaration: CustomRecursiveWalkerFn<CommonVisitorMethodNode>;
  ForOfStatement: CustomRecursiveWalkerFn<ForOfStatementNode>;
  FunctionDeclaration: CustomRecursiveWalkerFn<CommonVisitorMethodNode>;
  FunctionExpression: NOOP;
  ArrowFunctionExpression: NOOP;
  MethodDefinition: NOOP;
  AwaitExpression: CustomRecursiveWalkerFn<CommonVisitorMethodNode>;
  ReturnStatement: CustomRecursiveWalkerFn<CommonVisitorMethodNode>;
  VariableDeclaration: CustomRecursiveWalkerFn<VariableDeclarationNode>;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
type VisitorsWithoutAncestorsFunction = VisitorsWithoutAncestors[keyof VisitorsWithoutAncestors];
type CustomRecursiveWalkerNode = UnionToIntersection<
  Exclude<Parameters<VisitorsWithoutAncestorsFunction>[0], undefined>
>;

type CustomRecursiveWalkerFn<N extends Node> = (
  node: N,
  state: State,
  c: WalkerCallback<State>
) => void;
