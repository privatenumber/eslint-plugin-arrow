# TypeScript and arrow function class fields

TypeScript accepts the class fields that `classMethods: true` produces, and it reports two of the runtime hazards in [../ecmascript/class-fields.md](../ecmascript/class-fields.md), including one that crosses files. JavaScript projects get neither error.

Last verified: 2026-10-31, TypeScript 6.0.3.

## Experiment

Two files, checked together. They contain the output that the conversion would produce.

<!-- eslint-skip -->
```ts
// a.ts
export class ThisType { n = 1; m = (): this => this }
export class Optional { m? = (): number => 1 }
interface HasM { m(): number }
export class Implements implements HasM { m = () => 1 }
class Base { m() { return 1 } }
export class Override extends Base { override m = () => 2 }
export class FieldOrder { x = this.m(); m = () => 1 }
export class Parent { m = () => 1 }
```

<!-- eslint-skip -->
```ts
// b.ts
import { Parent } from './a.ts';
export class Child extends Parent { m() { return 2 } }
```

```sh
tsc --noEmit --strict --target es2022 --module nodenext --allowImportingTsExtensions --noImplicitOverride a.ts b.ts
```

```text
a.ts(7,36): error TS2729: Property 'm' is used before its initialization.
b.ts(2,37): error TS2425: Class 'Parent' defines instance member property 'm', but extended class 'Child' defines it as instance member function.
b.ts(2,37): error TS4114: This member must have an 'override' modifier because it overrides a member in the base class 'Parent'.
```

## Results

- **Accepted:** a `this` return type, an optional field (`m?`), a field that implements an interface method, and an `override` field over a parent method. The converted forms type-check.
- **TS2729** ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L3457-L3459)): an earlier field that reads the converted method. The rule skips this case, because JavaScript reports nothing until it throws.
- **TS2425** ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L2386-L2388)): a subclass in another file that defines a method with the same name as the parent's new field. This is the only cross-file hazard that a tool reports.
- **Not reported:** a parent constructor that calls a method that a subclass converted to a field. `Override` type-checks, but at runtime the parent constructor still calls `Base.prototype.m`.

## Field types differ from method types

Converting a method to an arrow function field changes how TypeScript checks it, in two ways that the field test found in real code. Both were reproduced on 2026-10-31 with TypeScript 6.0.3, running `tsc --noEmit --strict --target es2022 --ignoreConfig <file>`. zod 4.6.7 also failed with TypeScript 5.5.4.

### Parameters are checked contravariantly

The [`strictFunctionTypes` reference](https://www.typescriptlang.org/tsconfig/strictFunctionTypes.html) (accessed 2026-10-31) says the check "only applies to functions written in function syntax, not to those in method syntax". A field holding an arrow function uses function syntax, so a subclass can no longer narrow a parameter type:

<!-- eslint-skip -->
```ts
class A { m(x: string | number) {} }
class B extends A { m(x: string) {} }
// clean

class A { m = (x: string | number) => {} }
class B extends A { m = (x: string) => {} }
// error TS2416: Property 'm' in type 'B' is not assignable to the same property in base type 'A'.
```

zod and marked failed type checks this way with `classMethods: true`. The rule cannot see it without type information, so the option's docs list it as a reason to keep the option disabled.

### A `this` type can make the field's type circular

A field without a type annotation gets its type from its value. When the signature uses the `this` type and a generic constraint refers back to the class, TypeScript needs the class's type to type the field, and the field is part of that type:

<!-- eslint-skip -->
```ts
export abstract class Base<O = any> {
  readonly _o!: O;
  nullable(): Nullable<this> { return null as any }
  nullish = (): Optional<Nullable<this>> => this.nullable() as any
}
export class Optional<T extends Base> extends Base<{ t: T }> {}
export class Nullable<T extends Base> extends Base<{ t: T }> {}
// error TS7022: 'nullish' implicitly has type 'any' because it does not have a type annotation
// and is referenced directly or indirectly in its own initializer.
```

Without the constraint, the same `this` types compile. `self = (): this => null as any`, `wrap = (): Box<this> => null as any`, and `nullish = () => this.nullable()` with an unconstrained `Box<T>` were all clean. So the error needs the constraint, which the rule cannot evaluate. `prefer-arrow-functions` skips every method with a `this` type in its signature instead: a skip never breaks code, and it only affects code that opted in to `classMethods`. Tests: `this type / ...` in [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts).
