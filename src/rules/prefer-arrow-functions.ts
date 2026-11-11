import type { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.ts';
import { isTypeOnlyReference } from '../utils/is-type-only-reference.ts';

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

type Options = [{
	classMethods?: boolean;
	objectMethods?: boolean;
	namedFunctionExpressions?: boolean;
	allowedNames?: string[];
}];

// Properties that differ on an arrow function. `toString()` returns the source text
const disallowedProperties = new Set([
	'prototype',
	'name',
	'length',
	'toString',
]);

// `customElements.define()` reads these from the prototype, so it never calls class fields
// https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define
const customElementCallbacks = new Set([
	'connectedCallback',
	'disconnectedCallback',
	'connectedMoveCallback',
	'adoptedCallback',
	'attributeChangedCallback',
	'formAssociatedCallback',
	'formResetCallback',
	'formDisabledCallback',
	'formStateRestoreCallback',
]);

// `const` is only valid where a statement list is allowed
const declarationContainers = new Set<string>([
	'Program',
	'BlockStatement',
	'StaticBlock',
	'SwitchCase',
	'TSModuleBlock',
	'ExportNamedDeclaration',
	'ExportDefaultDeclaration',
]);

// Tokens that would continue the expression on the previous line without a semicolon
const continuationTokenPattern = /^[([`+\-/<]/;

// Statements and class members that end with a semicolon, unless the code relies on ASI
const semicolonTerminatedTypes = new Set<string>([
	'VariableDeclaration',
	'ExpressionStatement',
	'ReturnStatement',
	'ThrowStatement',
	'BreakStatement',
	'ContinueStatement',
	'DebuggerStatement',
	'ImportDeclaration',
	'ExportAllDeclaration',
	'PropertyDefinition',
]);

const isSemicolonTerminated = (
	node: TSESTree.Node,
) => (
	(
		semicolonTerminatedTypes.has(node.type)

		// `for (let i = 0; ...)` declarations end at the `;` that belongs to the loop
		&& !(node.parent && 'init' in node.parent && node.parent.init === node)
		&& !(node.parent && 'left' in node.parent && node.parent.left === node)
	)
	|| (node.type === 'ExportNamedDeclaration' && !node.declaration)
);

// Visits `roots` and their descendants
const walk = (
	sourceCode: Readonly<TSESLint.SourceCode>,
	roots: (TSESTree.Node | null | undefined)[],
	visit: (node: TSESTree.Node) => void,
) => {
	const stack = roots.filter(root => root !== null && root !== undefined);
	while (stack.length > 0) {
		const node = stack.pop()!;
		visit(node);

		for (const key of sourceCode.visitorKeys[node.type] ?? []) {
			const child = (node as unknown as Record<string, unknown>)[key];
			for (const value of Array.isArray(child) ? child : [child]) {
				if (value && typeof (value as TSESTree.Node).type === 'string') {
					stack.push(value as TSESTree.Node);
				}
			}
		}
	}
};

/**
 * Whether most statements in the file end with a semicolon, so new statements follow its style.
 * Without a majority, new statements only get a semicolon where ASI needs one
 */
const getSemicolonStyle = (
	sourceCode: Readonly<TSESLint.SourceCode>,
) => {
	let withSemicolon = 0;
	let withoutSemicolon = 0;
	walk(sourceCode, [sourceCode.ast], (node) => {
		if (!isSemicolonTerminated(node)) {
			return;
		}

		if (sourceCode.getLastToken(node)?.value === ';') {
			withSemicolon += 1;
		} else {
			withoutSemicolon += 1;
		}
	});

	return withSemicolon > withoutSemicolon;
};

// Arrow functions have assignment-level precedence, so they can only appear
// unparenthesized where an AssignmentExpression is accepted
const acceptsAssignmentExpression = (
	node: TSESTree.FunctionExpression,
) => {
	const { parent } = node;
	switch (parent.type) {
		case 'VariableDeclarator': {
			return parent.init === node;
		}
		case 'AssignmentExpression':
		case 'AssignmentPattern': {
			return parent.right === node;
		}
		case 'Property':
		case 'PropertyDefinition': {
			return parent.value === node;
		}
		case 'CallExpression':
		case 'NewExpression': {
			return parent.arguments.includes(node);
		}
		case 'ConditionalExpression': {
			return parent.test !== node;
		}
		case 'ArrowFunctionExpression': {
			return parent.body === node;
		}
		case 'ArrayExpression':
		case 'ReturnStatement':
		case 'SpreadElement':
		case 'YieldExpression':
		case 'TemplateLiteral':
		case 'JSXExpressionContainer': {
			return true;
		}
		default: {
			return false;
		}
	}
};

const isConstructorReference = (
	node: TSESTree.Identifier | TSESTree.JSXIdentifier | TSESTree.FunctionExpression,
) => {
	const { parent } = node;
	return (
		(parent.type === 'NewExpression' && parent.callee === node)
		|| (
			parent.type === 'BinaryExpression'
			&& parent.operator === 'instanceof'
			&& parent.right === node
		)
		|| (
			(parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression')
			&& parent.superClass === node
		)
	);
};

// `a.b`, `a['b']`, and `this.#b`, named the same way as `getKeyName`
const getPropertyName = (
	member: TSESTree.MemberExpression,
) => {
	const { property } = member;
	if (member.computed) {
		return property.type === 'Literal' && typeof property.value === 'string' ? property.value : undefined;
	}
	if (property.type === 'PrivateIdentifier') {
		return `#${property.name}`;
	}
	return property.type === 'Identifier' ? property.name : undefined;
};

const isFunctionPropertyReference = (
	node: TSESTree.Identifier | TSESTree.JSXIdentifier | TSESTree.FunctionExpression,
) => {
	const { parent } = node;
	if (parent.type !== 'MemberExpression' || parent.object !== node) {
		return false;
	}

	const name = getPropertyName(parent);
	return name !== undefined && disallowedProperties.has(name);
};

// ESLint's default JavaScript parser does not set `decorators`
const hasDecorators = (
	node: { decorators?: TSESTree.Decorator[] },
) => (node.decorators?.length ?? 0) > 0;

// `m`, `'m'`, and `['m']` all name the same method
const getKeyName = (
	member: TSESTree.MethodDefinition | TSESTree.Property | TSESTree.PropertyDefinition,
	sourceCode: Readonly<TSESLint.SourceCode>,
) => {
	const { key } = member;
	if (key.type === 'Literal') {
		return String(key.value);
	}
	if (!member.computed && key.type === 'Identifier') {
		return key.name;
	}
	if (key.type === 'PrivateIdentifier') {
		return `#${key.name}`;
	}

	// A computed expression such as `[name]` is compared by its source text
	return `[${sourceCode.getText(key)}]`;
};

const isOverloadedMethod = (
	method: TSESTree.MethodDefinition,
	sourceCode: Readonly<TSESLint.SourceCode>,
) => {
	const key = getKeyName(method, sourceCode);
	return method.parent.body.some(
		element => (
			element.type === 'MethodDefinition'
			&& element.value.type === 'TSEmptyBodyFunctionExpression'
			&& element.static === method.static
			&& getKeyName(element, sourceCode) === key
		),
	);
};

// The name `allowedNames` matches: the function's own name, or the binding it is assigned to
// The name that JavaScript gives an anonymous function from where it is defined, such as
// `const name = () => {}`. `undefined` when it gets no name
const getInferredName = (
	node: FunctionNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
) => {
	const { parent } = node;
	switch (parent.type) {
		case 'MethodDefinition':
		case 'Property':
		case 'PropertyDefinition': {
			// A computed key such as `[name]` gives `[name]`, which never matches a function name
			return getKeyName(parent, sourceCode);
		}
		case 'VariableDeclarator': {
			return parent.id.type === 'Identifier' ? parent.id.name : undefined;
		}
		case 'AssignmentExpression':
		case 'AssignmentPattern': {
			return parent.left.type === 'Identifier' ? parent.left.name : undefined;
		}
		default: {
			return undefined;
		}
	}
};

const getFunctionName = (
	node: FunctionNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
) => node.id?.name ?? getInferredName(node, sourceCode);

const messages = {
	preferArrowFunction: 'Prefer arrow function',
} as const;

type MessageIds = keyof typeof messages;

export const preferArrowFunctions = createRule<Options, MessageIds>({
	name: 'prefer-arrow-functions',
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer arrow functions when possible',
		},
		fixable: 'code',
		schema: [{
			type: 'object',
			properties: {
				classMethods: {
					type: 'boolean',
					description: 'Convert class methods to arrow function class fields, which bind `this` to the instance. Each instance then gets its own copy of the function as an own property, instead of sharing one method on the prototype.',
				},
				objectMethods: {
					type: 'boolean',
					description: 'Convert object shorthand methods such as `{ load() {} }` to arrow function properties.',
				},
				namedFunctionExpressions: {
					type: 'boolean',
					description: 'Convert function expressions whose own name differs from the name the arrow function gets, such as `callback(function onTick() {})`. The name is removed, so stack traces show the function as anonymous. Function expressions that keep their name, such as `const load = function load() {}`, are always converted.',
				},
				allowedNames: {
					type: 'array',
					items: {
						type: 'string',
					},
					uniqueItems: true,
					description: 'Names of functions and methods to never convert.',
				},
			},
			additionalProperties: false,
		}],
		messages,
	},

	defaultOptions: [{
		classMethods: false,
		objectMethods: true,
		namedFunctionExpressions: false,
		allowedNames: [],
	}],

	create: (context, [{
		classMethods,
		objectMethods,
		namedFunctionExpressions,
		allowedNames,
	}]) => {
		const untransformableFunctions = new Set<FunctionNode>();
		const functionsUsingThis = new Set<FunctionNode>();

		// Class fields shadow the prototype, so these names must stay methods.
		// They are collected from the whole file, so class methods are reported at `Program:exit`
		const superMemberNames = new Set<string>();
		const prototypeMemberNames = new Set<string>();
		const pendingClassMethods: TSESTree.FunctionExpression[] = [];

		// `this.name` reads that run while a field initializer or static block runs, by class member
		const eagerThisReads = new Map<TSESTree.Node, Set<string>>();

		const isTsx = context.filename.endsWith('.tsx');

		let semicolonStyle: boolean | undefined;
		const usesSemicolons = () => {
			semicolonStyle ??= getSemicolonStyle(context.sourceCode);
			return semicolonStyle;
		};

		// Returns `undefined` when the declaration cannot become a `const` binding
		const getDeclarationReferences = (
			node: TSESTree.FunctionDeclaration,
		): TSESLint.Scope.Reference[] | undefined => {
			// Default export can have anonymous function declarations
			if (!node.id) {
				return [];
			}

			if (!declarationContainers.has(node.parent.type)) {
				return;
			}

			// A top-level function in a classic script is a property of the global object,
			// and other scripts can redeclare it. A `const` is neither
			if (
				node.parent.type === 'Program'
				&& context.languageOptions.sourceType === 'script'
			) {
				return;
			}

			// In sloppy mode, a function declared in a block or `switch` case is also visible outside it,
			// but a `const` is only visible inside. See Annex B, "Block-Level Function Declarations".
			// Scope analysis does not model this, so references outside the block are not found
			const outerScope = context.sourceCode.getScope!(node).upper!;
			if (
				(outerScope.type === 'block' || outerScope.type === 'switch')
				&& !outerScope.isStrict
			) {
				return;
			}

			const [functionNameVariable] = context.sourceCode.getDeclaredVariables!(node);
			const { defs, references } = functionNameVariable;

			// Overloads, duplicate declarations, and `var` redeclarations
			// would become invalid `const` redeclarations
			if (defs.length > 1) {
				return;
			}

			// A `const` binding cannot be reassigned
			if (references.some(reference => reference.isWrite())) {
				return;
			}

			if (hasCircularTypeQuery(node, functionNameVariable)) {
				return;
			}

			const visited = new Set<TSESTree.Node>([node]);
			if (references.some(
				reference => canRunBefore(reference, node, functionNameVariable.scope, visited),
			)) {
				return;
			}

			return references;
		};

		const findVariable = (node: TSESTree.Node, name: string, namespace: 'type' | 'value') => {
			for (
				let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope!(node);
				scope;
				scope = scope.upper
			) {
				const variable = scope.set.get(name);
				if (variable && (namespace === 'type' ? variable.isTypeVariable : variable.isValueVariable ?? true)) {
					return variable;
				}
			}
		};

		const resolveTypeAlias = (reference: TSESTree.TSTypeReference) => {
			if (reference.typeName.type !== 'Identifier') {
				return;
			}
			const variable = findVariable(reference, reference.typeName.name, 'type');
			const declaration = variable?.defs.find(def => def.node.type === 'TSTypeAliasDeclaration')?.node;
			return declaration?.type === 'TSTypeAliasDeclaration' ? declaration : undefined;
		};

		const neverAliases = new Map<TSESTree.TSTypeAliasDeclaration, boolean>();
		const resolvesToNever = (reference: TSESTree.TSTypeReference) => {
			const visited = new Set<TSESTree.TSTypeAliasDeclaration>();
			let type: TSESTree.TypeNode | undefined = reference;
			let result = false;
			while (type?.type === 'TSTypeReference') {
				const alias = resolveTypeAlias(type);
				if (!alias || visited.has(alias)) {
					break;
				}
				const cached = neverAliases.get(alias);
				if (cached !== undefined) {
					result = cached;
					break;
				}
				visited.add(alias);
				type = alias.typeAnnotation;
			}
			result ||= type?.type === 'TSNeverKeyword';
			for (const alias of visited) {
				neverAliases.set(alias, result);
			}
			return result;
		};

		// Cache each alias's contents scan once per file
		const aliasContents = new Map<TSESTree.TSTypeAliasDeclaration, {
			queries: Set<TSESLint.Scope.Variable>;
			aliases: TSESTree.TSTypeAliasDeclaration[];
		}>();

		const resolveQuery = (query: TSESTree.TSTypeQuery) => {
			let name = query.exprName;
			while (name.type === 'TSQualifiedName') {
				name = name.left;
			}
			if (name.type !== 'Identifier') {
				return;
			}
			return findVariable(query, name.name, 'value');
		};

		const scanTypes = (nodes: (TSESTree.Node | undefined)[]) => {
			const queries = new Set<TSESLint.Scope.Variable>();
			const aliases: TSESTree.TSTypeAliasDeclaration[] = [];
			walk(context.sourceCode, nodes, (child) => {
				if (child.type === 'TSTypeQuery') {
					const variable = resolveQuery(child);
					if (variable) {
						queries.add(variable);
					}
				} else if (child.type === 'TSTypeReference') {
					const alias = resolveTypeAlias(child);
					if (alias) {
						aliases.push(alias);
					}
				}
			});
			return {
				queries,
				aliases,
			};
		};

		// As a `const`, a signature that reads its own type, directly or through same-file aliases,
		// or `typeof` a value whose initializer uses the function, can cause a circular type error
		const hasCircularTypeQuery = (
			node: TSESTree.FunctionDeclaration,
			ownVariable: TSESLint.Scope.Variable,
		) => {
			const { queries, aliases } = scanTypes([
				node.returnType, node.typeParameters, ...node.params,
			]);
			if (queries.has(ownVariable)) {
				return true;
			}
			for (const variable of queries) {
				const declarator = variable.defs[0]?.node;
				if (
					declarator?.type !== 'VariableDeclarator'
					|| !declarator.init
					|| declarator.id.typeAnnotation
				) {
					continue;
				}

				const [start, end] = declarator.init.range;
				if (ownVariable.references.some(({ identifier }) => (
					identifier.range[0] >= start && identifier.range[1] <= end
				))) {
					return true;
				}
			}
			const visited = new Set<TSESTree.TSTypeAliasDeclaration>();
			while (aliases.length > 0) {
				const alias = aliases.pop()!;
				if (visited.has(alias)) {
					continue;
				}
				visited.add(alias);
				let contents = aliasContents.get(alias);
				if (!contents) {
					contents = scanTypes([alias]);
					aliasContents.set(alias, contents);
				}
				if (contents.queries.has(ownVariable)) {
					return true;
				}
				for (const dependency of contents.aliases) {
					aliases.push(dependency);
				}
			}
			return false;
		};

		// A `const` binding cannot be used before its declaration runs. A reference after the
		// declaration still runs first when it is inside a hoisted function that is used earlier,
		// so the enclosing function declarations are checked the same way
		const canRunBefore = (
			reference: TSESLint.Scope.Reference,
			declaration: TSESTree.FunctionDeclaration,
			declarationScope: TSESLint.Scope.Scope,
			visited: Set<TSESTree.Node>,
		): boolean => {
			// `export { name }` only links the binding and never reads it, unlike `export default name`
			if (
				isTypeOnlyReference(reference)
				|| reference.identifier.parent.type === 'ExportSpecifier'
			) {
				return false;
			}

			if (reference.identifier.range[0] < declaration.range[0]) {
				return true;
			}

			// Each run of the scope that declares it creates a new binding, so outer calls do not matter
			for (
				let scope: TSESLint.Scope.Scope | null = reference.from;
				scope && scope !== declarationScope;
				scope = scope.upper
			) {
				const { block } = scope;

				// Code inside the declaration only runs after it is initialized
				if (block === declaration) {
					return false;
				}

				if (block.type !== 'FunctionDeclaration' || !block.id || visited.has(block)) {
					continue;
				}

				visited.add(block);
				const [enclosingFunction] = context.sourceCode.getDeclaredVariables!(block);
				if (enclosingFunction.references.some(
					enclosingReference => canRunBefore(
						enclosingReference,
						declaration,
						declarationScope,
						visited,
					),
				)) {
					return true;
				}
			}

			return false;
		};

		const isInsideScope = (
			parentScope: TSESLint.Scope.Scope,
			childScope: TSESLint.Scope.Scope,
		) => {
			let currentScope: null | TSESLint.Scope.Scope = childScope;
			while (currentScope && currentScope !== parentScope) {
				currentScope = currentScope.upper;
			}

			return currentScope === parentScope;
		};

		// Returns `undefined` when the expression references itself
		const getExpressionReferences = (
			node: TSESTree.FunctionExpression,
			scope: TSESLint.Scope.Scope,
		): TSESLint.Scope.Reference[] | undefined => {
			const references: TSESLint.Scope.Reference[] = [];
			// Parameters are also declared by the function, so match the function's own name exactly
			const functionNameVariable = node.id && context.sourceCode.getDeclaredVariables!(node).find(
				variable => variable.identifiers[0] === node.id,
			);

			if (functionNameVariable) {
				const recursiveReference = functionNameVariable.references.some(
					({ from }) => isInsideScope(scope, from),
				);
				if (recursiveReference) {
					return;
				}

				references.push(...functionNameVariable.references);
			}

			if (node.parent.type === 'VariableDeclarator') {
				const [functionVariable] = context.sourceCode.getDeclaredVariables!(node.parent);

				// The first reference is the variable declaration itself
				references.push(...functionVariable.references.slice(1));
			}

			return references;
		};

		// Preferences from options, as opposed to conversions that would change behavior
		const isExcludedByOptions = (
			node: FunctionNode,
		) => {
			const { parent } = node;
			if (
				(parent.type === 'MethodDefinition' && !classMethods)
				|| (parent.type === 'Property' && parent.method && !objectMethods)
				|| (
					node.type === 'FunctionExpression'
					&& node.id
					&& !namedFunctionExpressions

					// The arrow function gets the same name, so nothing changes
					&& getInferredName(node, context.sourceCode) !== node.id.name
				)
			) {
				return true;
			}

			const name = getFunctionName(node, context.sourceCode);
			// `createRule` merges `defaultOptions`, so `allowedNames` is always set
			return name !== undefined && allowedNames!.includes(name);
		};

		// A class field is an own property of each instance, created after the parent constructor
		// and the earlier fields run, so it hides any prototype method with the same name
		const canBeClassField = (
			method: TSESTree.MethodDefinition,
		) => {
			if (
				isOverloadedMethod(method, context.sourceCode)

				// Method and parameter decorators cannot be applied to class fields
				|| hasDecorators(method)
				|| method.value.params.some(hasDecorators)

				// The parent class could call the method from its constructor, before the field exists
				|| method.override
			) {
				return false;
			}

			// A field's type is inferred from its value, so a `this` type in the signature can make
			// the field's type depend on itself, which TypeScript reports as TS7022
			let usesThisType = false;
			const { value } = method;
			const signature = [value.returnType, value.typeParameters, ...value.params];
			walk(context.sourceCode, signature, (node) => {
				usesThisType ||= node.type === 'TSThisType';
			});
			if (usesThisType) {
				return false;
			}

			const name = getKeyName(method, context.sourceCode);

			// `super.name`, `Class.prototype.name`, and custom element callbacks only use the prototype
			if (
				superMemberNames.has(name)
				|| prototypeMemberNames.has(name)
				|| customElementCallbacks.has(name)
			) {
				return false;
			}

			// An earlier field initializer would read the field before it is defined
			const classMembers = method.parent.body;
			return !classMembers.slice(0, classMembers.indexOf(method)).some(
				member => eagerThisReads.get(member)?.has(name),
			);
		};

		const isToStringRead = (
			node: TSESTree.Node,
		) => (
			node.parent?.type === 'MemberExpression'
			&& node.parent.object === node
			&& getPropertyName(node.parent) === 'toString'
		);

		// `toString()` returns the source text, which includes the functions inside it
		const isInsideReadSource = (
			node: FunctionNode,
		) => {
			for (
				let ancestor: TSESTree.Node | undefined = node.parent;
				ancestor;
				ancestor = ancestor.parent
			) {
				if (
					ancestor.type !== 'FunctionDeclaration'
					&& ancestor.type !== 'FunctionExpression'
					&& ancestor.type !== 'ArrowFunctionExpression'
					&& ancestor.type !== 'ClassDeclaration'
					&& ancestor.type !== 'ClassExpression'
				) {
					continue;
				}

				const variables = [
					// Its own name, not its parameters, which are also declared by it
					...context.sourceCode.getDeclaredVariables!(ancestor).filter(
						variable => variable.defs.some(
							definition => definition.node === ancestor && definition.type !== 'Parameter',
						),
					),
					...(
						ancestor.parent.type === 'VariableDeclarator'
							? context.sourceCode.getDeclaredVariables!(ancestor.parent)
							: []
					),
				];
				if (
					isToStringRead(ancestor)
					|| variables.some(variable => variable.references.some(
						reference => isToStringRead(reference.identifier),
					))
				) {
					return true;
				}
			}
			return false;
		};

		const isConvertable = (
			node: FunctionNode,
		) => {
			// Generators cannot be arrow functions
			if (
				node.generator
				|| untransformableFunctions.has(node)
				|| isExcludedByOptions(node)
				|| isInsideReadSource(node)
			) {
				return false;
			}

			const { parent } = node;
			if (parent.type === 'Property' || parent.type === 'MethodDefinition') {
				// Object/Class getters, setters, and constructors cannot be arrow functions
				if (['set', 'get', 'constructor'].includes(parent.kind)) {
					return false;
				}

				if (parent.type === 'MethodDefinition' && !canBeClassField(parent)) {
					return false;
				}

				// `{ __proto__() {} }` defines a method, but `{ __proto__: value }` sets the prototype.
				// Computed `['__proto__']` keys always define own properties
				if (
					parent.type === 'Property'
					&& !parent.computed
					&& (
						(parent.key.type === 'Identifier' && parent.key.name === '__proto__')
						|| (parent.key.type === 'Literal' && parent.key.value === '__proto__')
					)
				) {
					return false;
				}
			}

			// Sloppy mode allows repeated parameter names, but arrow functions never do
			const parameterNames = node.params.flatMap(
				parameter => (parameter.type === 'Identifier' ? [parameter.name] : []),
			);
			if (new Set(parameterNames).size < parameterNames.length) {
				return false;
			}

			// An arrow function class field binds `this` to the instance, like an instance method.
			// A static arrow field binds `this` to its declaring class, even when called on a subclass
			if (
				functionsUsingThis.has(node)
				&& (parent.type !== 'MethodDefinition' || parent.static)
			) {
				return false;
			}

			// Arrow functions cannot be constructed or extended, and some of their properties differ
			if (
				node.type === 'FunctionExpression'
				&& (isConstructorReference(node) || isFunctionPropertyReference(node))
			) {
				return false;
			}

			// TypeScript only applies `asserts` and `never` return types to control flow analysis
			// when the callee is a function declaration or an explicitly annotated variable
			const returnType = node.returnType?.typeAnnotation;
			if (
				(returnType?.type === 'TSTypePredicate' && returnType.asserts)
				|| returnType?.type === 'TSNeverKeyword'
				|| (returnType?.type === 'TSTypeReference' && resolvesToNever(returnType))
			) {
				return false;
			}

			// Arrow functions cannot declare a TypeScript `this` parameter
			const [firstParameter] = node.params;
			if (firstParameter?.type === 'Identifier' && firstParameter.name === 'this') {
				return false;
			}

			const scope = context.sourceCode.getScope!(node);
			const hasArguments = scope.set.get('arguments')!.references.length > 0;
			if (hasArguments) {
				return false;
			}

			const references = (
				node.type === 'FunctionDeclaration'
					? getDeclarationReferences(node)
					: getExpressionReferences(node, scope)
			);

			return references !== undefined && !references.some(
				({ identifier }) => (
					isConstructorReference(identifier)
					|| isFunctionPropertyReference(identifier)
				),
			);
		};

		// In TSX, `<T>(` parses as a JSX element unless the type parameter list has a trailing comma
		const fixTsxTypeParameters = (
			node: FunctionNode,
			fixer: TSESLint.RuleFixer,
		) => {
			const typeParameters = node.typeParameters?.params;
			if (
				!isTsx
				|| typeParameters?.length !== 1
				|| typeParameters[0].constraint
			) {
				return [];
			}

			const closingToken = context.sourceCode.getLastToken(node.typeParameters!)!;
			const tokenBefore = context.sourceCode.getTokenBefore(closingToken)!;
			return tokenBefore.value === ',' ? [] : [fixer.insertTextAfter(typeParameters[0], ',')];
		};

		const getNearestFunction = (
			node: TSESTree.ThisExpression | TSESTree.Super | TSESTree.MetaProperty,
		): FunctionNode | undefined => {
			let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope!(node);

			while (scope) {
				// `this` in a class field or static block refers to the class, not an outer function
				if (
					scope.type === 'class-field-initializer'
					|| scope.type === 'class-static-block'
				) {
					return;
				}

				if (
					scope.block.type === 'FunctionDeclaration'
					|| scope.block.type === 'FunctionExpression'
				) {
					return scope.block;
				}

				scope = scope.upper;
			}
		};

		const markUntransformable = (
			node: TSESTree.ThisExpression | TSESTree.Super | TSESTree.MetaProperty,
		) => {
			const functionNode = getNearestFunction(node);
			if (functionNode) {
				untransformableFunctions.add(functionNode);
			}
		};

		// Whether only whitespace separates `token` from the next token or comment
		const getFollowingSpace = (
			token: TSESTree.Token | TSESTree.Node,
		) => {
			const next = context.sourceCode.getTokenAfter(token, { includeComments: true });
			if (!next) {
				return;
			}

			const between = context.sourceCode.text.slice(token.range[1], next.range[0]);
			return between.trim() === '' ? between : undefined;
		};

		// Removes the token and the spaces after it, but keeps comments and line breaks
		const removeWithFollowingSpace = (
			token: TSESTree.Token | TSESTree.Node,
			fixer: TSESLint.RuleFixer,
		) => {
			const space = getFollowingSpace(token);
			const removableSpace = space?.includes('\n') ? '' : space;
			return fixer.removeRange([
				token.range[0],
				token.range[1] + (removableSpace?.length ?? 0),
			]);
		};

		const removeFunctionToken = (
			node: FunctionNode,
			fixer: TSESLint.RuleFixer,
		) => {
			const functionToken = context.sourceCode.getFirstToken(node, {
				filter: token => token.type === 'Keyword' && token.value === 'function',
			});

			if (functionToken) {
				return [removeWithFollowingSpace(functionToken, fixer)];
			}
			return [];
		};

		const insertArrow = (
			node: FunctionNode,
			fixer: TSESLint.RuleFixer,
		) => {
			const parenEnd = context.sourceCode.getTokenBefore(node.body)!;

			// `(a){}` becomes `(a) => {}`, and `(a) {}` becomes `(a) => {}`
			const needsTrailingSpace = getFollowingSpace(parenEnd) === '';
			return [fixer.insertTextAfter(parenEnd, needsTrailingSpace ? ' => ' : ' =>')];
		};

		const moveAsyncToken = (
			node: FunctionNode,
			fixer: TSESLint.RuleFixer,
		) => {
			const asyncToken = context.sourceCode.getFirstToken(node.parent, {
				filter: token => token.type === 'Identifier' && token.value === 'async',
			});
			const getNodeAfter = context.sourceCode.getTokenAfter(asyncToken!, {
				includeComments: true,
			});
			return [
				fixer.removeRange([asyncToken!.range[0], getNodeAfter!.range[0]]),
				fixer.insertTextBefore(node, 'async '),
			];
		};

		const wrapInParentheses = (
			node: FunctionNode,
			fixer: TSESLint.RuleFixer,
		) => [
			fixer.insertTextBefore(node, '('),
			fixer.insertTextAfter(node, ')'),
		];

		const reportFunctionExpression = (
			node: TSESTree.FunctionExpression,
		) => {
			if (!isConvertable(node)) {
				return;
			}

			context.report({
				node,
				messageId: 'preferArrowFunction',
				fix: (fixer) => {
					const fixes: TSESLint.RuleFix[] = [
						...insertArrow(node, fixer),
						...fixTsxTypeParameters(node, fixer),
					];

					const { parent } = node;
					const isMethod = (
						(
							// Object method
							parent.type === 'Property'
							&& parent.method
						) || (
							// Class method
							parent.type === 'MethodDefinition'
							&& parent.kind === 'method'
						)
					);

					if (isMethod) {
						const hasSpaceBefore = /\s/.test(context.sourceCode.text[node.range[0] - 1]);
						let separator = parent.type === 'Property' ? ': ' : '= ';
						if (parent.type === 'MethodDefinition' && !hasSpaceBefore) {
							separator = ` ${separator}`;
						}
						fixes.push(fixer.insertTextBefore(node, separator));

						if (node.async) {
							fixes.push(...moveAsyncToken(node, fixer));
						}

						// Unlike a method, a class field needs a `;` or line break before the next member
						const nextToken = context.sourceCode.getTokenAfter(parent);
						if (
							parent.type === 'MethodDefinition'
							&& nextToken
							&& nextToken.value !== ';'
							&& (
								usesSemicolons()
								|| (
									nextToken.loc.start.line === parent.loc.end.line
									&& nextToken.value !== '}'
								)
							)
						) {
							fixes.push(fixer.insertTextAfter(node, ';'));
						}
					} else {
						fixes.push(...removeFunctionToken(node, fixer));

						if (node.id) {
							fixes.push(removeWithFollowingSpace(node.id, fixer));
						}

						if (!acceptsAssignmentExpression(node)) {
							const previousToken = context.sourceCode.getTokenBefore(node);
							const nextToken = context.sourceCode.getTokenAfter(node);

							if (!(
								previousToken?.value === '('
								&& nextToken?.value === ')'
							)) {
								fixes.push(...wrapInParentheses(node, fixer));
							}
						}
					}

					return fixes;
				},
			});
		};

		// Records `this.name` when it runs as part of a class field initializer or static block,
		// rather than later from a function
		const recordEagerThisRead = (
			member: TSESTree.MemberExpression,
		) => {
			const name = getPropertyName(member);
			if (name === undefined) {
				return;
			}

			let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope!(member);
			while (scope && scope.type !== 'function') {
				if (scope.type === 'class-field-initializer' || scope.type === 'class-static-block') {
					// A field initializer scope's block is the value; its parent is the field
					const classMember = scope.block.type === 'StaticBlock' ? scope.block : scope.block.parent!;
					const names = eagerThisReads.get(classMember) ?? new Set();
					names.add(name);
					eagerThisReads.set(classMember, names);
					return;
				}
				scope = scope.upper;
			}
		};

		return {
			ThisExpression: (node) => {
				const functionNode = getNearestFunction(node);
				if (functionNode) {
					functionsUsingThis.add(functionNode);
				}
			},
			Super: (node) => {
				markUntransformable(node);

				const { parent } = node;
				if (parent.type === 'MemberExpression' && parent.object === node) {
					const name = getPropertyName(parent);
					if (name !== undefined) {
						superMemberNames.add(name);
					}
				}
			},
			MetaProperty: (node) => {
				if (
					node.meta.name === 'new'
					&& node.property.name === 'target'
				) {
					markUntransformable(node);
				}
			},
			MemberExpression: (node) => {
				if (node.object.type === 'ThisExpression') {
					recordEagerThisRead(node);
					return;
				}

				if (node.object.type === 'MemberExpression' && getPropertyName(node.object) === 'prototype') {
					const name = getPropertyName(node);
					if (name !== undefined) {
						prototypeMemberNames.add(name);
					}
				}
			},
			'FunctionExpression:exit': (node) => {
				// Class methods depend on names collected from the whole file
				if (node.parent.type === 'MethodDefinition') {
					pendingClassMethods.push(node);
					return;
				}

				reportFunctionExpression(node);
			},
			'Program:exit': () => {
				for (const method of pendingClassMethods) {
					reportFunctionExpression(method);
				}
			},
			'FunctionDeclaration:exit': (node) => {
				if (!isConvertable(node)) {
					return;
				}

				context.report({
					node,
					messageId: 'preferArrowFunction',
					fix: (fixer) => {
						const fixes: TSESLint.RuleFix[] = [
							...insertArrow(node, fixer),
							...removeFunctionToken(node, fixer),
							...fixTsxTypeParameters(node, fixer),
						];

						// Default export can have unnamed function declarations
						if (node.id) {
							const functionNameString = context.sourceCode.getText(node.id);

							fixes.push(
								removeWithFollowingSpace(node.id, fixer),
								fixer.insertTextBefore(node, `const ${functionNameString} = `),
							);
						}

						const { parent } = node;
						if (
							parent.type === 'ExportDefaultDeclaration'
							&& node.id
						) {
							const exportDefaultStart = context.sourceCode.getFirstToken(parent, {
								filter: token => token.type === 'Keyword' && token.value === 'export',
							})!;
							const exportDefaultEnd = context.sourceCode.getTokenAfter(exportDefaultStart, {
								filter: token => token.type === 'Keyword' && token.value === 'default',
							})!;
							const exportDefaultRange: TSESTree.Range = [
								exportDefaultStart.range[0],
								exportDefaultEnd.range[1],
							];
							const exportDefaultString = context.sourceCode.text.slice(...exportDefaultRange);
							fixes.push(
								fixer.removeRange([
									exportDefaultRange[0],
									exportDefaultRange[1] + (getFollowingSpace(exportDefaultEnd)?.length ?? 0),
								]),
								fixer.insertTextAfter(
									node,
									`${usesSemicolons() ? ';' : ''}\n${exportDefaultString} ${node.id.name}`,
								),
							);
						}

						// Insert a semicolon if the file uses them,
						// or if the next token would otherwise continue the expression
						const nextToken = context.sourceCode.getTokenAfter(node);
						const needsDelimiter = (
							nextToken?.value !== ';'
							&& (
								usesSemicolons()
								|| (
									nextToken
									&& nextToken.value !== '}'
									&& (
										nextToken.loc.start.line === node.loc.end.line
										|| continuationTokenPattern.test(nextToken.value)
									)
								)
							)
						);

						if (needsDelimiter) {
							fixes.push(fixer.insertTextAfter(node, ';'));
						}

						return fixes;
					},
				});
			},
		};
	},
});
