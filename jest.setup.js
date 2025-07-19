// Jest setup file
global.console = {
    ...console,
    // Suppress console.log during tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock fetch for testing environment
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
    })
);

// Mock globalThis.fetch if needed
global.globalThis = global.globalThis || {};
global.globalThis.fetch = global.fetch;

// Use real timers for setup
jest.useRealTimers();