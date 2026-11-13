# Custom element lifecycle callbacks

The browser reads custom element lifecycle callbacks from the class prototype once, when `customElements.define()` runs. A callback written as an arrow function class field is an own property of each instance, so the browser never calls it. `prefer-arrow-functions` 2.0 keeps all class methods. Version 1.x also kept these callbacks when `classMethods: true`.

Last verified: 2026-10-31, against the [HTML Living Standard](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define) (accessed 2026-10-31) and headless Chrome 156.

## Specification

The `define(name, constructor, options)` steps read the callbacks from the prototype, not from instances:

> Let prototype be ? Get(constructor, "prototype"). ... Let lifecycleCallbacks be the ordered map «[ "connectedCallback" → null, "disconnectedCallback" → null, "connectedMoveCallback" → null, "adoptedCallback" → null, "attributeChangedCallback" → null ]». For each callbackName of the keys of lifecycleCallbacks: Let callbackValue be ? Get(prototype, callbackName).

For form-associated elements, the same steps read four more names from the prototype:

> If formAssociated is true, then for each callbackName of « "formAssociatedCallback", "formResetCallback", "formDisabledCallback", "formStateRestoreCallback" »: Let callbackValue be ? Get(prototype, callbackName).

The rule's list of names is `customElementCallbacks` in [src/rules/prefer-arrow-functions.ts](../../src/rules/prefer-arrow-functions.ts). Update it when the standard adds a callback.

## Experiment

Run in the console of headless Chrome 156 on `about:blank`:

<!-- eslint-skip -->
```js
const calls = [];
class MethodElement extends HTMLElement {
	static observedAttributes = ['value'];
	connectedCallback() { calls.push('method: connectedCallback'); }
	attributeChangedCallback() { calls.push('method: attributeChangedCallback'); }
	disconnectedCallback() { calls.push('method: disconnectedCallback'); }
}
class FieldElement extends HTMLElement {
	static observedAttributes = ['value'];
	connectedCallback = () => { calls.push('field: connectedCallback'); };
	attributeChangedCallback = () => { calls.push('field: attributeChangedCallback'); };
	disconnectedCallback = () => { calls.push('field: disconnectedCallback'); };
}
customElements.define('method-element', MethodElement);
customElements.define('field-element', FieldElement);
for (const tag of ['method-element', 'field-element']) {
	const element = document.createElement(tag);
	document.body.append(element);
	element.setAttribute('value', '1');
	element.remove();
	calls.push(`${tag}: own connectedCallback is ${typeof element.connectedCallback}`);
}
JSON.stringify(calls, null, 1)
```

```text
"[\n \"method: connectedCallback\",\n \"method: attributeChangedCallback\",\n \"method: disconnectedCallback\",\n \"method-element: own connectedCallback is function\",\n \"field-element: own connectedCallback is function\"\n]"
```

The method callbacks ran for connect, attribute change, and disconnect. The field callbacks never ran, although each instance had `connectedCallback` as a function. The experiment did not cover `adoptedCallback`, `connectedMoveCallback`, or the form-associated callbacks; the rule keeps them based on the specification steps above.
