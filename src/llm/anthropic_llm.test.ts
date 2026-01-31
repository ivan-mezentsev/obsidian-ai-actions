import { AnthropicLLM } from "./anthropic_llm";
import type { AIProvider } from "../types";

type MockAnthropicClient = {
	messages: {
		create: jest.Mock;
	};
};

// Mock the Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
	return jest.fn().mockImplementation(() => ({
		messages: {
			create: jest.fn(),
		},
	}));
});

describe("AnthropicLLM", () => {
	let anthropicLLM: AnthropicLLM;
	let mockProvider: AIProvider;
	let mockClient: MockAnthropicClient;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-anthropic",
			name: "Test Anthropic",
			type: "anthropic",
			apiKey: "test-api-key",
			url: "https://api.anthropic.com",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create AnthropicLLM instance
		anthropicLLM = new AnthropicLLM(
			mockProvider,
			"claude-3-sonnet-20240229",
			false
		);

		// Get the mock client
		mockClient = anthropicLLM["client"] as unknown as MockAnthropicClient;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(anthropicLLM).toBeDefined();
			expect(anthropicLLM["modelName"]).toBe("claude-3-sonnet-20240229");
		});

		it("should set useNativeFetch correctly", () => {
			const anthropicWithNativeFetch = new AnthropicLLM(
				mockProvider,
				"claude-3-sonnet-20240229",
				true
			);
			expect(anthropicWithNativeFetch).toBeDefined();
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Generated completion text",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				system: "You are a helpful assistant",
				messages: [
					{
						role: "user",
						content: "Write a hello world function",
					},
				],
			});
		});

		it("should use default temperature and maxOutputTokens when not provided", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Default response",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			await anthropicLLM.autocomplete("System prompt", "User input");

			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				system: "System prompt",
				messages: [
					{
						role: "user",
						content: "User input",
					},
				],
			});
		});

		it("should handle empty response gracefully", async () => {
			const mockResponse = { content: [] };
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponse = { content: [{ type: "image" }] };
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should propagate API errors with custom message", async () => {
			const apiError = new Error("API rate limit exceeded");
			mockClient.messages.create.mockRejectedValue(apiError);

			await expect(
				anthropicLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Anthropic API error: API rate limit exceeded");
		});

		it("should handle unknown errors", async () => {
			mockClient.messages.create.mockRejectedValue("Unknown error");

			await expect(
				anthropicLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Anthropic API error: Unknown error");
		});

		it("should have identical final result for streaming and non-streaming modes", async () => {
			const expectedText = "Hello world response";

			// Setup mocks for both modes to return the same final result
			const mockNonStreamingResponse = {
				content: [
					{
						type: "text",
						text: expectedText,
					},
				],
			};

			const mockStreamingResponse = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					// Simulate streaming the same text in chunks
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "Hello",
						},
					};
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: " world",
						},
					};
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: " response",
						},
					};
				},
			};

			// Test non-streaming mode
			mockClient.messages.create.mockResolvedValue(
				mockNonStreamingResponse
			);
			const nonStreamingCallback = jest.fn();
			const nonStreamingResult = await anthropicLLM.autocomplete(
				"Test prompt",
				"Test content",
				nonStreamingCallback,
				0.7,
				1000,
				undefined,
				false
			);

			// Test streaming mode
			mockClient.messages.create.mockResolvedValue(mockStreamingResponse);
			const streamingCallback = jest.fn();
			let streamingResult = "";
			const mockStreamingCallbackWrapper = (chunk: string) => {
				streamingResult += chunk;
				streamingCallback(chunk);
			};

			await anthropicLLM.autocomplete(
				"Test prompt",
				"Test content",
				mockStreamingCallbackWrapper,
				0.7,
				1000,
				undefined,
				true
			);

			// Verify identical final results
			expect(nonStreamingResult).toBe(expectedText);
			expect(streamingResult).toBe(expectedText);

			// Verify different callback behavior but same final outcome
			expect(nonStreamingCallback).toHaveBeenCalledTimes(1);
			expect(nonStreamingCallback).toHaveBeenCalledWith(expectedText);

			expect(streamingCallback).toHaveBeenCalledTimes(3);
			expect(streamingCallback).toHaveBeenNthCalledWith(1, "Hello");
			expect(streamingCallback).toHaveBeenNthCalledWith(2, " world");
			expect(streamingCallback).toHaveBeenNthCalledWith(3, " response");
		});

		it("should not call callback in non-streaming mode when result is empty", async () => {
			const mockResponse = { content: [] };
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await anthropicLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				false
			);

			expect(result).toBe("");
			expect(callback).not.toHaveBeenCalled();
		});

		it("should successfully stream completion without userPrompt", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "Hello",
						},
					};
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: " world",
						},
					};
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "!",
						},
					};
				},
			};
			mockClient.messages.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await anthropicLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				500,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");
			expect(callback).toHaveBeenNthCalledWith(3, "!");

			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 500,
				temperature: 0.8,
				system: "You are helpful",
				messages: [
					{
						role: "user",
						content: "Say hello",
					},
				],
				stream: true,
			});
		});

		it("should handle userPrompt correctly", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "Response with user prompt",
						},
					};
				},
			};
			mockClient.messages.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await anthropicLLM.autocomplete(
				"System instruction",
				"Content text",
				callback,
				0.7,
				1000,
				"User custom prompt",
				true
			);

			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				system: "System instruction",
				messages: [
					{
						role: "user",
						content: "User custom prompt",
					},
					{
						role: "user",
						content: "Content text",
					},
				],
				stream: true,
			});
		});

		it("should handle streaming errors", async () => {
			const streamError = new Error("Streaming connection failed");
			mockClient.messages.create.mockRejectedValue(streamError);

			const callback = jest.fn();

			await expect(
				anthropicLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow(
				"Anthropic API error: Streaming connection failed"
			);
		});

		it("should handle empty streaming chunks gracefully", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "valid",
						},
					};
					yield { type: "other_type" }; // Non-delta type
					yield {
						type: "content_block_delta",
						delta: { type: "other_delta" },
					}; // Non-text delta
				},
			};
			mockClient.messages.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await anthropicLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			// Should only call callback for valid chunks
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("valid");
		});
	});

	describe("edge cases and error scenarios", () => {
		it("should handle network errors gracefully", async () => {
			const networkError = new Error("Network connection failed");
			mockClient.messages.create.mockRejectedValue(networkError);

			await expect(
				anthropicLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Anthropic API error: Network connection failed");
		});

		it("should handle authentication errors", async () => {
			const authError = new Error("Invalid API key");
			mockClient.messages.create.mockRejectedValue(authError);

			await expect(
				anthropicLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Anthropic API error: Invalid API key");
		});

		it("should handle rate limit errors", async () => {
			const rateLimitError = new Error("Rate limit exceeded");
			mockClient.messages.create.mockRejectedValue(rateLimitError);

			const callback = jest.fn();
			await expect(
				anthropicLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Anthropic API error: Rate limit exceeded");
		});
	});

	describe("getDefaultBaseUrl", () => {
		it("should return correct default base URL", () => {
			const defaultUrl = anthropicLLM["getDefaultBaseUrl"]();
			expect(defaultUrl).toBe("https://api.anthropic.com");
		});
	});

	describe("getHeaders", () => {
		it("should return correct headers with API key", () => {
			const headers = anthropicLLM["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
				"anthropic-version": "2023-06-01",
				"x-api-key": "test-api-key",
			});
		});

		it("should return headers without API key when not provided", () => {
			const providerWithoutKey = { ...mockProvider, apiKey: "" };
			const llmWithoutKey = new AnthropicLLM(
				providerWithoutKey,
				"claude-3-sonnet-20240229",
				false
			);
			const headers = llmWithoutKey["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
				"anthropic-version": "2023-06-01",
			});
		});
	});

	describe("systemPromptSupport parameter", () => {
		it("should use system parameter when systemPromptSupport is true", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Response with system prompt",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				true
			);

			expect(result).toBe("Response with system prompt");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				system: "You are a helpful assistant",
				messages: [
					{
						role: "user",
						content: "Write a hello world function",
					},
				],
			});
		});

		it("should add prompt as first user message when systemPromptSupport is false", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Response without system prompt",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				false
			);

			expect(result).toBe("Response without system prompt");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				messages: [
					{
						role: "user",
						content: "You are a helpful assistant",
					},
					{
						role: "user",
						content: "Write a hello world function",
					},
				],
			});
		});

		it("should handle userPrompt correctly when systemPromptSupport is false", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Response with user prompt and no system",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt",
				false,
				false
			);

			expect(result).toBe("Response with user prompt and no system");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				messages: [
					{
						role: "user",
						content: "System instruction",
					},
					{
						role: "user",
						content: "User custom prompt",
					},
					{
						role: "user",
						content: "Content text",
					},
				],
			});
		});

		it("should use system parameter in streaming mode when systemPromptSupport is true", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "Streaming with system",
						},
					};
				},
			};
			mockClient.messages.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await anthropicLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				500,
				undefined,
				true,
				true
			);

			expect(callback).toHaveBeenCalledWith("Streaming with system");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 500,
				temperature: 0.8,
				system: "You are helpful",
				messages: [
					{
						role: "user",
						content: "Say hello",
					},
				],
				stream: true,
			});
		});

		it("should add prompt as first user message in streaming mode when systemPromptSupport is false", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "content_block_delta",
						delta: {
							type: "text_delta",
							text: "Streaming without system",
						},
					};
				},
			};
			mockClient.messages.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await anthropicLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				500,
				undefined,
				true,
				false
			);

			expect(callback).toHaveBeenCalledWith("Streaming without system");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 500,
				temperature: 0.8,
				messages: [
					{
						role: "user",
						content: "You are helpful",
					},
					{
						role: "user",
						content: "Say hello",
					},
				],
				stream: true,
			});
		});

		it("should default to systemPromptSupport=true when parameter is not provided", async () => {
			const mockResponse = {
				content: [
					{
						type: "text",
						text: "Default behavior response",
					},
				],
			};
			mockClient.messages.create.mockResolvedValue(mockResponse);

			const result = await anthropicLLM.autocomplete(
				"Default system prompt",
				"Default content"
			);

			expect(result).toBe("Default behavior response");
			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-sonnet-20240229",
				max_tokens: 1000,
				temperature: 0.7,
				system: "Default system prompt",
				messages: [
					{
						role: "user",
						content: "Default content",
					},
				],
			});
		});
	});
});
