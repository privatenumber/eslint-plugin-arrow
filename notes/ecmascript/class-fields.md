# Class fields versus methods

An arrow function class field (`m = () => {}`) is not a method. It is an own data property that the constructor creates on each instance, and its `this` is fixed when the field is created. Every difference below follows from that, and each one shows why the former 1.x `classMethods: true` option could change behavior.

Last verified: 2026-10-31, Node.js v26.13.0, against the [ES2025 specification](https://tc39.es/ecma262/2025/).

## Mechanism

- **Fields are own properties.** [DefineField](https://tc39.es/ecma262/2025/#sec-definefield) calls the initializer with the instance as the receiver, then runs `CreateDataPropertyOrThrow(receiver, fieldName, initValue)`. Methods are defined once on the prototype.
- **Fields are created in order, when the instance is constructed.** [InitializeInstanceElements](https://tc39.es/ecma262/2025/#sec-initializeinstanceelements) runs `DefineField` for each field record in source order. A base class does this before its constructor body, and a derived class does it after `super()` returns, so the parent constructor always runs before the subclass's fields exist.
- **Static fields bind `this` to the declaring class.** [ClassDefinitionEvaluation](https://tc39.es/ecma262/2025/#sec-runtime-semantics-classdefinitionevaluation) runs `DefineField(F, elementRecord)` for static elements, where `F` is the class being defined. An arrow function in a static field captures that `this`. A static method gets `this` from the call, which is the subclass when called as `Child.method()`.

## Experiments

Each experiment ran with `node --input-type=module -` reading the code from stdin.

### What the conversion gains

<!-- eslint-skip -->
```js
class H { n = 1; viaMethod() { return this?.n } viaField = () => this.n }
const h = new H(); const { viaMethod, viaField } = h;
console.log('5 detached method:', viaMethod(), '| detached field:', viaField());
```

```text
5 detached method: undefined | detached field: 1
```

This is the only behavior that the field adds: a detached reference, such as an event handler, keeps `this`. A method that does not use `this` gains nothing from the conversion.

### What changes for the instance

<!-- eslint-skip -->
```js
import assert from 'node:assert';
class M { n = 1; get() { return this.n } }
class F { n = 1; get = () => this.n }
console.log('Object.keys method:', Object.keys(new M()), '| field:', Object.keys(new F()));
console.log('spread has get, method:', 'get' in { ...new M() }, '| field:', 'get' in { ...new F() });
try { structuredClone(new M()); console.log('structuredClone method: ok') } catch (e) { console.log('structuredClone method:', e.name) }
try { structuredClone(new F()); console.log('structuredClone field: ok') } catch (e) { console.log('structuredClone field:', e.name) }
try { assert.deepStrictEqual(new M(), new M()); console.log('deepStrictEqual method: equal') } catch { console.log('deepStrictEqual method: not equal') }
try { assert.deepStrictEqual(new F(), new F()); console.log('deepStrictEqual field: equal') } catch { console.log('deepStrictEqual field: not equal') }
console.log('shared function, method:', new M().get === new M().get, '| field:', new F().get === new F().get);
```

```text
Object.keys method: [ 'n' ] | field: [ 'n', 'get' ]
spread has get, method: false | field: true
structuredClone method: ok
structuredClone field: DataCloneError
deepStrictEqual method: equal
deepStrictEqual field: not equal
shared function, method: true | field: false
```

These changes can reach code in other files, such as tests that compare instances, `postMessage()` and IndexedDB (which use structured cloning), and serializers that enumerate own properties. A lint rule cannot see those uses.

### What changes for inheritance and construction

<!-- eslint-skip -->
```js
// 1. Parent method becomes a field; subclass keeps a method (e.g. it calls super)
class P1 { m = () => 'parent' }
class C1 extends P1 { m() { return 'child' } }
console.log('1 subclass override:', new C1().m());

// 2. Base constructor calls a method that the subclass converted to a field
class P2 { constructor() { this.label = this.name() } name() { return 'base' } }
class C2 extends P2 { name = () => 'child' }
console.log('2 base constructor sees:', new C2().label);

// 3. Prototype-based spying/mocking
class S { m = () => 1 }
console.log('3 S.prototype.m:', S.prototype.m);

// 4. Earlier field initializer reads a converted method
class F { x = this.m(); m = () => 1 }
try { new F() } catch (e) { console.log('4 field order:', e.constructor.name + ': ' + e.message) }
```

```text
1 subclass override: parent
2 base constructor sees: base
3 S.prototype.m: undefined
4 field order: TypeError: this.m is not a function
```

<!-- eslint-skip -->
```js
class P { static viaMethod() { return this.name } static viaField = () => this.name }
class C extends P {}
console.log('static this, method:', C.viaMethod(), '| field:', C.viaField());
```

```text
static this, method: C | field: P
```

### What stays the same

<!-- eslint-skip -->
```js
class P { m() { return 'p' } }
class C extends P { m = () => 'c+' + super.m() }
console.log('super in field arrow:', new C().m());
try { new Function('class X { f = () => arguments }') } catch (e) { console.log('arguments in field:', e.constructor.name + ': ' + e.message) }
class N { m() { return new.target } f = () => new.target }
console.log('new.target method:', new N().m(), '| field:', new N().f());
```

```text
super in field arrow: c+p
arguments in field: SyntaxError: 'arguments' is not allowed in class field initializer or static initialization block
new.target method: undefined | field: undefined
```

- `super.name` works inside an arrow function field, so a method that uses `super` could be converted. The rule still skips it; see [prefer-arrow-functions-options.md](../eslint-plugin-arrow/prefer-arrow-functions-options.md#classmethods).
- A method that uses `arguments` cannot be converted, because the result does not parse.
- A method cannot be called with `new`, so `new.target` is always `undefined` in a method and in a field.

## What a lint rule can detect in one file

| Hazard | Signal in the same file |
| --- | --- |
| A subclass in the same file calls `super.name` | A `super.name` member expression |
| Code reads `Class.prototype.name` | A `.prototype.name` member expression |
| An earlier field or static block reads `this.name` | A `this.name` read in that initializer, outside a nested function |
| A static method uses `this` | `this` in a static method |
| A parent constructor calls the method | Only the TypeScript `override` modifier, and only as a hint |
| Subclasses, mocks, deep equality, or cloning in other files | None |

[../typescript/class-fields.md](../typescript/class-fields.md) covers which of these TypeScript reports across files.
