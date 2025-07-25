import { OpenAILLM, OpenAIModel } from "./openai_llm";
import type { ChatCompletion } from "../../__mocks__/openai";

type MockOpenAIClient = {
	chat: {
		completions: {
			create: jest.Mock;
		};
	};
};

// Mock the OpenAI SDK
jest.mock("openai", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: jest.fn(),
			},
		},
	})),
}));

describe("OpenAILLM", () => {
	let openaiLLM: OpenAILLM;
	let mockClient: MockOpenAIClient;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create OpenAILLM instance
		openaiLLM = new OpenAILLM(
			OpenAIModel.GPT_4O_MINI,
			"test-api-key",
			"https://api.openai.com/v1"
		);

		// Get the mock client
		mockClient = openaiLLM["openai"] as unknown as MockOpenAIClient;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(openaiLLM).toBeDefined();
			expect(openaiLLM["model"]).toBe(OpenAIModel.GPT_4O_MINI);
		});

		it("should initialize without baseURL", () => {
			const openaiWithoutBase = new OpenAILLM(
				OpenAIModel.GPT_4O_MINI,
				"test-api-key"
			);
			expect(openaiWithoutBase).toBeDefined();
		});

		it("should handle empty baseURL", () => {
			const openaiWithEmptyBase = new OpenAILLM(
				OpenAIModel.GPT_4O_MINI,
				"test-api-key",
				""
			);
			expect(openaiWithEmptyBase).toBeDefined();
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: "Generated completion text",
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			const result = await openaiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				messages: [
					{
						role: "system",
						content: "You are a helpful assistant",
					},
					{
						role: "user",
						content: "Write a hello world function",
					},
				],
				max_tokens: 1000,
				temperature: 0.7,
			});
		});

		it("should use default temperature and maxOutputTokens when not provided", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: "Default response",
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			await openaiLLM.autocomplete("System prompt", "User input");

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				messages: [
					{ role: "system", content: "System prompt" },
					{ role: "user", content: "User input" },
				],
				max_tokens: 4000,
				temperature: 0.7,
			});
		});

		it("should handle empty response gracefully", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 0,
					total_tokens: 10,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			const result = await openaiLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: null,
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 0,
					total_tokens: 10,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			const result = await openaiLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should propagate API errors", async () => {
			const apiError = new Error("API rate limit exceeded");
			mockClient.chat.completions.create.mockRejectedValue(apiError);

			await expect(
				openaiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("API rate limit exceeded");
		});

		it("should handle userPrompt correctly", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: "Response with user prompt",
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 15,
					completion_tokens: 25,
					total_tokens: 40,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			await openaiLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				messages: [
					{ role: "system", content: "System instruction" },
					{ role: "user", content: "User custom prompt" },
					{ role: "user", content: "Content text" },
				],
				max_tokens: 1000,
				temperature: 0.7,
			});
		});

		it("should handle zero and negative maxOutputTokens correctly", async () => {
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: "Response",
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 10,
					total_tokens: 20,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			// Test with zero maxOutputTokens
			await openaiLLM.autocomplete(
				"prompt",
				"content",
				undefined,
				0.7,
				0
			);

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				messages: [
					{ role: "system", content: "prompt" },
					{ role: "user", content: "content" },
				],
				max_tokens: 4000,
				temperature: 0.7,
			});

			// Test with negative maxOutputTokens
			await openaiLLM.autocomplete(
				"prompt",
				"content",
				undefined,
				0.7,
				-100
			);

			expect(mockClient.chat.completions.create).toHaveBeenLastCalledWith(
				{
					model: OpenAIModel.GPT_4O_MINI,
					messages: [
						{ role: "system", content: "prompt" },
						{ role: "user", content: "content" },
					],
					max_tokens: 4000,
					temperature: 0.7,
				}
			);
		});

		it("should have identical final result for streaming and non-streaming modes", async () => {
			const expectedText = "Hello world response";

			// Setup mocks for both modes
			const mockNonStreamingResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: expectedText,
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30,
				},
			};

			const mockStreamingResponse = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: "Hello" },
								finish_reason: null,
							},
						],
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: " world" },
								finish_reason: null,
							},
						],
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: " response" },
								finish_reason: "stop",
							},
						],
					};
				},
			};

			// Test non-streaming mode
			mockClient.chat.completions.create.mockResolvedValue(
				mockNonStreamingResponse
			);
			const nonStreamingCallback = jest.fn();
			const nonStreamingResult = await openaiLLM.autocomplete(
				"Test prompt",
				"Test content",
				nonStreamingCallback,
				0.7,
				1000,
				undefined,
				false
			);

			// Test streaming mode
			mockClient.chat.completions.create.mockResolvedValue(
				mockStreamingResponse
			);
			const streamingCallback = jest.fn();
			let streamingResult = "";
			const mockStreamingCallbackWrapper = (chunk: string) => {
				streamingResult += chunk;
				streamingCallback(chunk);
			};

			await openaiLLM.autocomplete(
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
			const mockResponse: ChatCompletion = {
				id: "test-id",
				object: "chat.completion",
				created: Date.now(),
				model: OpenAIModel.GPT_4O_MINI,
				choices: [],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 0,
					total_tokens: 10,
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await openaiLLM.autocomplete(
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
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: "Hello" },
								finish_reason: null,
							},
						],
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: " world" },
								finish_reason: null,
							},
						],
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: "!" },
								finish_reason: "stop",
							},
						],
					};
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await openaiLLM.autocomplete(
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

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				messages: [
					{ role: "system", content: "You are helpful" },
					{ role: "user", content: "Say hello" },
				],
				max_tokens: 500,
				temperature: 0.8,
				stream: true,
			});
		});

		it("should handle streaming errors", async () => {
			const streamError = new Error("Streaming connection failed");
			mockClient.chat.completions.create.mockRejectedValue(streamError);

			const callback = jest.fn();

			await expect(
				openaiLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Streaming connection failed");
		});

		it("should handle empty streaming chunks gracefully", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: "valid" },
								finish_reason: null,
							},
						],
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [], // Empty choices
					};
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: {}, // No content
								finish_reason: null,
							},
						],
					};
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await openaiLLM.autocomplete(
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

		it("should return void for streaming mode", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: OpenAIModel.GPT_4O_MINI,
						choices: [
							{
								index: 0,
								delta: { content: "test" },
								finish_reason: "stop",
							},
						],
					};
				},
			};
			mockClient.chat.completions.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			const result = await openaiLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			expect(result).toBeUndefined();
		});
	});

	describe("edge cases and error scenarios", () => {
		it("should handle network errors gracefully", async () => {
			const networkError = new Error("Network connection failed");
			mockClient.chat.completions.create.mockRejectedValue(networkError);

			await expect(
				openaiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Network connection failed");
		});

		it("should handle authentication errors", async () => {
			const authError = new Error("Invalid API key");
			mockClient.chat.completions.create.mockRejectedValue(authError);

			await expect(
				openaiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Invalid API key");
		});

		it("should handle rate limit errors", async () => {
			const rateLimitError = new Error("Rate limit exceeded");
			mockClient.chat.completions.create.mockRejectedValue(
				rateLimitError
			);

			const callback = jest.fn();
			await expect(
				openaiLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Rate limit exceeded");
		});
	});
});
