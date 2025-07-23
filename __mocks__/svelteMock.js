// Mock for Svelte components
class MockSvelteComponent {
    constructor(options) {
        this.target = options.target;
        this.props = options.props || {};
        this.eventHandlers = {};
    }

    $on(event, handler) {
        this.eventHandlers[event] = handler;
    }

    $set(props) {
        Object.assign(this.props, props);
    }

    $destroy() {
        // Mock destroy
    }

    // Mock methods that might be called
    show(prompt) {
        this.props.visible = true;
        this.props.prompt = prompt;
    }

    hide() {
        this.props.visible = false;
    }
}

module.exports = MockSvelteComponent;