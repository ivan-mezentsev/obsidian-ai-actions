// Mock for Svelte runtime APIs used in tests
const MockSvelteComponent = require("./svelteMock.js");

function mount(Component, options) {
	if (typeof Component === "function") {
		try {
			return new Component(options);
		} catch {
			return Component(options);
		}
	}
	return new MockSvelteComponent(options);
}

function unmount(component) {
	if (component && typeof component.$destroy === "function") {
		component.$destroy();
	}
}

module.exports = { mount, unmount };
