// Mock the standardFetch and nativeFetch utilities
const mockStandardFetch = jest.fn();
const mockNativeFetch = jest.fn();

jest.mock("../utils/fetch", () => ({
	standardFetch: mockStandardFetch,
	nativeFetch: mockNativeFetch,
}));

// Mock TextDecoder for Node.js test environment
import { TextDecoder, TextEncoder } from "util";

// Setup TextDecoder and TextEncoder for Node.js test environment
Object.assign(globalThis, {
	TextDecoder,
	TextEncoder,
});

import { OpenRouterLLM } from "./openrouter_llm";
import type { AIProvider } from "../types";
import {
	createMockResponse,
	createMockStreamReader,
} from "../../__mocks__/response";

describe("OpenRouterLLM", () => {
	let openRouterLLM: OpenRouterLLM;
	let mockProvider: AIProvider;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-openrouter",
			name: "Test OpenRouter",
			type: "openrouter",
			apiKey: "test-api-key",
			url: "https://openrouter.ai/api/v1",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create OpenRouterLLM instance
		openRouterLLM = new OpenRouterLLM(
			mockProvider,
			"mistralai/mistral-7b-instruct",
			false
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(openRouterLLM).toBeDefined();
			expect(openRouterLLM["modelName"]).toBe(
				"mistralai/mistral-7b-instruct"
			);
		});

		it("should set useNativeFetch correctly", () => {
			const openRouterWithNativeFetch = new OpenRouterLLM(
				mockProvider,
				"mistralai/mistral-7b-instruct",
				true
			);
			expect(openRouterWithNativeFetch).toBeDefined();
		});
	});

	describe("getDefaultBaseUrl", () => {
		it("should return the correct default base URL", () => {
			expect(openRouterLLM["getDefaultBaseUrl"]()).toBe(
				"https://openrouter.ai/api/v1"
			);
		});
	});

	describe("getHeaders", () => {
		it("should include OpenRouter specific headers", () => {
			const headers = openRouterLLM["getHeaders"]();

			expect(headers["Content-Type"]).toBe("application/json");
			expect(headers["Authorization"]).toBe("Bearer test-api-key");
			expect(headers["HTTP-Referer"]).toBe("https://obsidian.md");
			expect(headers["X-Title"]).toBe("Obsidian AI Actions");
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({
				choices: [
					{
						message: {
							content: "Generated completion text",
						},
					},
				],
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const result = await openRouterLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
						"HTTP-Referer": "https://obsidian.md",
						"X-Title": "Obsidian AI Actions",
					},
					body: JSON.stringify({
						model: "mistralai/mistral-7b-instruct",
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
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				}
			);
		});

		it("should use default temperature and max_tokens when not provided", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({
				choices: [
					{
						message: {
							content: "Default response",
						},
					},
				],
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			await openRouterLLM.autocomplete("System prompt", "User input");

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "mistralai/mistral-7b-instruct",
						messages: [
							{
								role: "user",
								content: "System prompt",
							},
							{
								role: "user",
								content: "User input",
							},
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should handle empty response gracefully", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({ choices: [] });
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const result = await openRouterLLM.autocomplete(
				"prompt",
				"content"
			);
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({
				choices: [{ message: null }],
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const result = await openRouterLLM.autocomplete(
				"prompt",
				"content"
			);
			expect(result).toBe("");
		});

		it("should propagate API errors with custom message", async () => {
			const mockResponse = createMockResponse({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			await expect(
				openRouterLLM.autocomplete("prompt", "content")
			).rejects.toThrow("OpenRouter API error: 429 Too Many Requests");
		});

		it("should handle network errors", async () => {
			const networkError = new Error("Network connection failed");
			mockStandardFetch.mockRejectedValue(networkError);

			await expect(
				openRouterLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Network connection failed");
		});

		it("should handle userPrompt parameter correctly", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({
				choices: [
					{
						message: {
							content: "Response with user prompt",
						},
					},
				],
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			await openRouterLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "mistralai/mistral-7b-instruct",
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
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should call callback with the full result in non-streaming mode", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({
				choices: [
					{
						message: {
							content: "Test response",
						},
					},
				],
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			const result = await openRouterLLM.autocomplete(
				"prompt",
				"content",
				callback
			);

			expect(result).toBe("Test response");
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("Test response");
		});

		it("should not call callback in non-streaming mode when result is empty", async () => {
			const mockResponse = createMockResponse({
				ok: true,
			});
			mockResponse.setJsonResponse({ choices: [] });
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			const result = await openRouterLLM.autocomplete(
				"prompt",
				"content",
				callback
			);

			expect(result).toBe("");
			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe("streaming mode", () => {
		const createMockStreamResponse = (chunks: string[]) => {
			const mockReader = createMockStreamReader();

			// Setup read mock to return chunks
			let readIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (readIndex < chunks.length) {
					const chunk = chunks[readIndex++];
					const encoder = new globalThis.TextEncoder();
					return Promise.resolve({
						done: false,
						value: encoder.encode(chunk),
					});
				} else {
					return Promise.resolve({ done: true, value: undefined });
				}
			});

			const response = createMockResponse({
				ok: true,
			});
			response.setStreamReader(mockReader);
			return response;
		};

		it("should successfully stream completion", async () => {
			const streamChunks = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			const mockResponse = createMockStreamResponse(streamChunks);
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			await openRouterLLM.autocomplete(
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

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "mistralai/mistral-7b-instruct",
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
						temperature: 0.8,
						max_tokens: 500,
						stream: true,
					}),
				})
			);
		});

		it("should handle streaming errors", async () => {
			const mockResponse = createMockResponse({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();

			await expect(
				openRouterLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow(
				"OpenRouter API error: 500 Internal Server Error"
			);
		});

		it("should handle missing response body reader", async () => {
			const mockResponse = createMockResponse({
				ok: true,
				body: null,
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();

			await expect(
				openRouterLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("No response body reader available");
		});

		it("should handle invalid JSON in streaming chunks gracefully", async () => {
			const streamChunks = [
				'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n',
				"data: invalid-json\n\n",
				'data: {"choices":[{"delta":{"content":" content"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			const mockResponse = createMockStreamResponse(streamChunks);
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			await openRouterLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			// Should only call callback for valid chunks
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Valid");
			expect(callback).toHaveBeenNthCalledWith(2, " content");
		});

		it("should handle empty streaming chunks gracefully", async () => {
			const streamChunks = [
				'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
				'data: {"choices":[]}\n\n', // Empty choices
				'data: {"choices":[{"delta":{}}]}\n\n', // Empty delta
				'data: {"choices":[{"delta":{"content":""}}]}\n\n', // Empty content
				"data: [DONE]\n\n",
			];

			const mockResponse = createMockStreamResponse(streamChunks);
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			await openRouterLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			// Should only call callback for valid chunks with content
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("valid");
		});

		it("should have identical final result for streaming and non-streaming modes", async () => {
			const expectedText = "Hello world response";

			// Setup non-streaming mock
			const mockNonStreamingResponse = createMockResponse({
				ok: true,
			});
			mockNonStreamingResponse.setJsonResponse({
				choices: [
					{
						message: {
							content: expectedText,
						},
					},
				],
			});

			// Setup streaming mock
			const streamChunks = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" response"}}]}\n\n',
				"data: [DONE]\n\n",
			];
			const mockStreamingResponse =
				createMockStreamResponse(streamChunks);

			// Test non-streaming mode
			mockStandardFetch.mockResolvedValue(
				mockNonStreamingResponse as Response
			);
			const nonStreamingCallback = jest.fn();
			const nonStreamingResult = await openRouterLLM.autocomplete(
				"Test prompt",
				"Test content",
				nonStreamingCallback,
				0.7,
				1000,
				undefined,
				false
			);

			// Test streaming mode
			mockStandardFetch.mockResolvedValue(
				mockStreamingResponse as Response
			);
			const streamingCallback = jest.fn();
			let streamingResult = "";
			const mockStreamingCallbackWrapper = (chunk: string) => {
				streamingResult += chunk;
				streamingCallback(chunk);
			};

			await openRouterLLM.autocomplete(
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
	});

	describe("edge cases and error scenarios", () => {
		it("should handle authentication errors", async () => {
			const mockResponse = createMockResponse({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			await expect(
				openRouterLLM.autocomplete("prompt", "content")
			).rejects.toThrow("OpenRouter API error: 401 Unauthorized");
		});

		it("should handle rate limit errors", async () => {
			const mockResponse = createMockResponse({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			const callback = jest.fn();
			await expect(
				openRouterLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("OpenRouter API error: 429 Too Many Requests");
		});

		it("should handle server errors", async () => {
			const mockResponse = createMockResponse({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});
			mockStandardFetch.mockResolvedValue(mockResponse as Response);

			await expect(
				openRouterLLM.autocomplete("prompt", "content")
			).rejects.toThrow(
				"OpenRouter API error: 500 Internal Server Error"
			);
		});
	});
});
