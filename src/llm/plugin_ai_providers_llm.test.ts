import { PluginAIProvidersLLM } from "./plugin_ai_providers_llm";

// Mock the waitForAI function
jest.mock("@obsidian-ai-providers/sdk");

import { waitForAI } from "@obsidian-ai-providers/sdk";
import type { IAIProvider, AIProviderType } from "@obsidian-ai-providers/sdk";
const mockWaitForAI = waitForAI as jest.MockedFunction<typeof waitForAI>;

type MockAIProvidersService = {
	version: number;
	providers: IAIProvider[];
	execute: jest.Mock<Promise<MockChunkHandler>, [ExecuteArgs]>;
	fetchModels: jest.Mock;
	embed: jest.Mock;
	checkCompatibility: jest.Mock;
	migrateProvider: jest.Mock;
};

type MockChunkHandler = {
	onData: jest.Mock<void, [(cb: (chunk: string) => void) => void]>;
	onEnd: jest.Mock<void, [(cb: () => void) => void]>;
	onError: jest.Mock<void, [(cb: (err: Error) => void) => void]>;
};

type ExecuteArgs = {
	provider: IAIProvider;
	messages: Array<{ role: "user" | "system"; content: string }>;
};

describe("PluginAIProvidersLLM", () => {
	let pluginAIProvidersLLM: PluginAIProvidersLLM;
	let mockAIProviders: MockAIProvidersService;
	let mockChunkHandler: MockChunkHandler;

	const testProviderId = "test-provider-id";

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create mock AI providers service
		mockAIProviders = {
			version: 1,
			providers: [
				{
					id: testProviderId,
					name: "Test Provider",
					type: "openai" as AIProviderType,
					model: "gpt-4",
				},
			],
			execute: jest.fn<Promise<MockChunkHandler>, [ExecuteArgs]>(),
			fetchModels: jest.fn(),
			embed: jest.fn(),
			checkCompatibility: jest.fn(),
			migrateProvider: jest.fn(),
		};

		// Create mock chunk handler
		mockChunkHandler = {
			onData: jest.fn<void, [(cb: (chunk: string) => void) => void]>(),
			onEnd: jest.fn<void, [(cb: () => void) => void]>(),
			onError: jest.fn<void, [(cb: (err: Error) => void) => void]>(),
		};

		// Setup waitForAI mock
		mockWaitForAI.mockResolvedValue({
			promise: Promise.resolve(mockAIProviders),
			cancel: jest.fn(),
		});

		// Create PluginAIProvidersLLM instance
		pluginAIProvidersLLM = new PluginAIProvidersLLM(testProviderId);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct provider ID", () => {
			expect(pluginAIProvidersLLM).toBeDefined();
			expect(pluginAIProvidersLLM["pluginAIProviderId"]).toBe(
				testProviderId
			);
		});

		it("should initialize with different provider ID", () => {
			const differentProviderId = "different-provider";
			const differentLLM = new PluginAIProvidersLLM(differentProviderId);
			expect(differentLLM["pluginAIProviderId"]).toBe(
				differentProviderId
			);
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion without userPrompt", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			// Setup chunk handler to call callbacks
			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Generated completion text");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockWaitForAI).toHaveBeenCalled();
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "You are a helpful assistant" },
					{ role: "user", content: "Write a hello world function" },
				],
			});
		});

		it("should successfully generate completion with userPrompt", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Response with user prompt");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(result).toBe("Response with user prompt");
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "System instruction" },
					{ role: "user", content: "User custom prompt" },
					{ role: "user", content: "Content text" },
				],
			});
		});

		it("should handle streaming mode with callback", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			const callback = jest.fn();

			mockChunkHandler.onData.mockImplementation(callbackFn => {
				callbackFn("Hello");
				callbackFn(" world");
				callbackFn("!");
			});
			mockChunkHandler.onEnd.mockImplementation(callbackFn => {
				callbackFn();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content",
				callback,
				0.7,
				1000,
				undefined,
				true
			);

			expect(result).toBeUndefined();
			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");
			expect(callback).toHaveBeenNthCalledWith(3, "!");
		});

		it("should handle non-streaming mode with callback", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			const callback = jest.fn();

			mockChunkHandler.onData.mockImplementation(callbackFn => {
				callbackFn("Complete response");
			});
			mockChunkHandler.onEnd.mockImplementation(callbackFn => {
				callbackFn();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content",
				callback,
				0.7,
				1000,
				undefined,
				false
			);

			expect(result).toBe("Complete response");
			expect(callback).not.toHaveBeenCalled();
		});

		it("should throw error when provider not found", async () => {
			// Create empty providers array
			mockAIProviders.providers = [];

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow(`Provider with id ${testProviderId} not found`);
		});

		it("should throw error when waitForAI fails", async () => {
			mockWaitForAI.mockRejectedValue(
				new Error("AI providers not available")
			);

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow("AI providers not available");
		});

		it("should handle execute errors", async () => {
			mockAIProviders.execute.mockRejectedValue(
				new Error("Execute failed")
			);

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow("Plugin AI providers API error: Execute failed");
		});

		it("should handle chunk handler errors", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onError.mockImplementation(callbackFn => {
				callbackFn(new Error("Chunk processing failed"));
			});

			const executePromise = pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			await expect(executePromise).rejects.toThrow(
				"Plugin AI providers API error: Chunk processing failed"
			);
		});

		it("should handle unknown errors", async () => {
			mockAIProviders.execute.mockRejectedValue("Unknown error");

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow("Plugin AI providers API error: Unknown error");
		});

		it("should work with different provider types", async () => {
			const ollamaProvider: IAIProvider = {
				id: "ollama-provider",
				name: "Ollama Provider",
				type: "ollama" as AIProviderType,
				model: "llama2",
			};

			mockAIProviders.providers = [ollamaProvider];
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Ollama response");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const ollamaLLM = new PluginAIProvidersLLM("ollama-provider");
			const result = await ollamaLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			expect(result).toBe("Ollama response");
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: ollamaProvider,
				messages: [
					{ role: "user", content: "Test prompt" },
					{ role: "user", content: "Test content" },
				],
			});
		});

		it("should handle empty response gracefully", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			// Don't call onData, just call onEnd
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			expect(result).toBe("");
		});

		it("should accumulate chunks correctly in non-streaming mode", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callbackFn => {
				["Hello", " ", "world", "!"].forEach(chunk => {
					callbackFn(chunk);
				});
			});
			mockChunkHandler.onEnd.mockImplementation(callbackFn => {
				callbackFn();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content",
				undefined,
				0.7,
				1000,
				undefined,
				false
			);

			expect(result).toBe("Hello world!");
		});

		it("should handle multiple providers and find correct one", async () => {
			const multipleProviders: IAIProvider[] = [
				{
					id: "provider-1",
					name: "Provider 1",
					type: "openai" as AIProviderType,
					model: "gpt-3.5",
				},
				{
					id: testProviderId,
					name: "Target Provider",
					type: "ollama" as AIProviderType,
					model: "llama2",
				},
				{
					id: "provider-3",
					name: "Provider 3",
					type: "gemini" as AIProviderType,
					model: "gemini-pro",
				},
			];

			mockAIProviders.providers = multipleProviders;
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Target provider response");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			expect(result).toBe("Target provider response");
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: multipleProviders[1], // The target provider
				messages: [
					{ role: "user", content: "Test prompt" },
					{ role: "user", content: "Test content" },
				],
			});
		});
	});

	describe("edge cases and error scenarios", () => {
		it("should handle waitForAI promise rejection", async () => {
			mockWaitForAI.mockResolvedValue({
				promise: Promise.reject(
					new Error("Provider initialization failed")
				),
				cancel: jest.fn(),
			});

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow("Provider initialization failed");
		});

		it("should handle malformed waitForAI response", async () => {
			const mockEmptyService = {
				version: 1,
				providers: [],
				execute: jest.fn(),
				fetchModels: jest.fn(),
				embed: jest.fn(),
				checkCompatibility: jest.fn(),
				migrateProvider: jest.fn(),
			};
			mockWaitForAI.mockResolvedValue({
				promise: Promise.resolve(mockEmptyService),
				cancel: jest.fn(),
			});

			await expect(
				pluginAIProvidersLLM.autocomplete("Test prompt", "Test content")
			).rejects.toThrow();
		});

		it("should handle provider without required fields", async () => {
			mockAIProviders.providers = [
				{
					id: testProviderId,
					name: "Incomplete Provider",
					type: "openai" as AIProviderType,
					// missing model field
				},
			];
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Response from incomplete provider");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			expect(result).toBe("Response from incomplete provider");
		});

		it("should handle very long responses", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			let longResponse = "";
			for (let i = 0; i < 1000; i++) {
				longResponse += `This is chunk ${i}. `;
			}

			mockChunkHandler.onData.mockImplementation(callback => {
				callback(longResponse);
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content"
			);

			expect(result).toBe(longResponse);
			expect(typeof result === "string" && result.length).toBeGreaterThan(
				10000
			);
		});

		it("should handle concurrent requests", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Concurrent response");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const promises = [
				pluginAIProvidersLLM.autocomplete("Prompt 1", "Content 1"),
				pluginAIProvidersLLM.autocomplete("Prompt 2", "Content 2"),
				pluginAIProvidersLLM.autocomplete("Prompt 3", "Content 3"),
			];

			const results = await Promise.all(promises);

			expect(results).toHaveLength(3);
			results.forEach(result => {
				expect(result).toBe("Concurrent response");
			});
			expect(mockAIProviders.execute).toHaveBeenCalledTimes(3);
		});
	});

	describe("systemPromptSupport parameter", () => {
		it("should ignore systemPromptSupport parameter when true", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Response ignoring systemPromptSupport");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				true // systemPromptSupport = true
			);

			expect(result).toBe("Response ignoring systemPromptSupport");
			// Verify that messages are still formatted the same way (no system role)
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "System instruction" },
					{ role: "user", content: "Content text" },
				],
			});
		});

		it("should ignore systemPromptSupport parameter when false", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Response ignoring systemPromptSupport false");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				false // systemPromptSupport = false
			);

			expect(result).toBe("Response ignoring systemPromptSupport false");
			// Verify that messages are still formatted the same way (no system role)
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "System instruction" },
					{ role: "user", content: "Content text" },
				],
			});
		});

		it("should ignore systemPromptSupport with userPrompt", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			mockChunkHandler.onData.mockImplementation(callback => {
				callback("Response with userPrompt and systemPromptSupport");
			});
			mockChunkHandler.onEnd.mockImplementation(callback => {
				callback();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt",
				false,
				true // systemPromptSupport = true
			);

			expect(result).toBe(
				"Response with userPrompt and systemPromptSupport"
			);
			// Verify that messages are still formatted the same way with userPrompt
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "System instruction" },
					{ role: "user", content: "User custom prompt" },
					{ role: "user", content: "Content text" },
				],
			});
		});

		it("should work in streaming mode with systemPromptSupport", async () => {
			mockAIProviders.execute.mockResolvedValue(mockChunkHandler);

			const callback = jest.fn();

			mockChunkHandler.onData.mockImplementation(callbackFn => {
				callbackFn("Streaming");
				callbackFn(" with");
				callbackFn(" systemPromptSupport");
			});
			mockChunkHandler.onEnd.mockImplementation(callbackFn => {
				callbackFn();
			});

			const result = await pluginAIProvidersLLM.autocomplete(
				"Test prompt",
				"Test content",
				callback,
				0.7,
				1000,
				undefined,
				true, // streaming = true
				true // systemPromptSupport = true
			);

			expect(result).toBeUndefined();
			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "Streaming");
			expect(callback).toHaveBeenNthCalledWith(2, " with");
			expect(callback).toHaveBeenNthCalledWith(3, " systemPromptSupport");
			// Verify messages are still formatted the same way
			expect(mockAIProviders.execute).toHaveBeenCalledWith({
				provider: mockAIProviders.providers[0],
				messages: [
					{ role: "user", content: "Test prompt" },
					{ role: "user", content: "Test content" },
				],
			});
		});
	});
});
