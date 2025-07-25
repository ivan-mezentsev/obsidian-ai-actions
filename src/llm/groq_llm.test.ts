import { GroqLLM } from "./groq_llm";
import type { AIProvider } from "../types";
import { nativeFetch, standardFetch } from "../utils/fetch";
import { TextDecoder, TextEncoder } from "util";

// Mock the fetch utils
jest.mock("../utils/fetch", () => ({
	nativeFetch: jest.fn(),
	standardFetch: jest.fn(),
}));

// Setup TextDecoder for Node.js test environment
Object.assign(globalThis, {
	TextDecoder,
	TextEncoder,
});

type MockResponse = {
	ok: boolean;
	status: number;
	statusText: string;
	json: jest.Mock;
	body?: {
		getReader: jest.Mock;
	};
};

type MockReader = {
	read: jest.Mock;
	releaseLock: jest.Mock;
};

const mockNativeFetch = nativeFetch as jest.MockedFunction<typeof nativeFetch>;
const mockStandardFetch = standardFetch as jest.MockedFunction<
	typeof standardFetch
>;

describe("GroqLLM", () => {
	let groqLLM: GroqLLM;
	let mockProvider: AIProvider;
	let mockResponse: MockResponse;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-groq",
			name: "Test Groq",
			type: "groq",
			apiKey: "test-api-key",
			url: "https://api.groq.com/openai/v1",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create GroqLLM instance
		groqLLM = new GroqLLM(mockProvider, "llama2-70b-4096", false);

		// Create mock response
		mockResponse = {
			ok: true,
			status: 200,
			statusText: "OK",
			json: jest.fn(),
		};

		mockStandardFetch.mockResolvedValue(mockResponse);
		mockNativeFetch.mockResolvedValue(mockResponse);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(groqLLM).toBeDefined();
			expect(groqLLM["modelName"]).toBe("llama2-70b-4096");
		});

		it("should set useNativeFetch correctly", () => {
			const groqWithNativeFetch = new GroqLLM(
				mockProvider,
				"llama2-70b-4096",
				true
			);
			expect(groqWithNativeFetch).toBeDefined();
		});

		it("should use default base URL when provider URL is not provided", () => {
			const providerWithoutUrl = { ...mockProvider };
			delete providerWithoutUrl.url;
			const groqWithDefaultUrl = new GroqLLM(
				providerWithoutUrl,
				"llama2-70b-4096",
				false
			);
			expect(groqWithDefaultUrl["getBaseUrl"]()).toBe(
				"https://api.groq.com/openai/v1"
			);
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponseData = {
				choices: [
					{
						message: {
							content: "Generated completion text",
						},
					},
				],
			};
			mockResponse.json.mockResolvedValue(mockResponseData);

			const result = await groqLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://api.groq.com/openai/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
					},
					body: JSON.stringify({
						model: "llama2-70b-4096",
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
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				}
			);
		});

		it("should use default temperature and max_tokens when not provided", async () => {
			const mockResponseData = {
				choices: [
					{
						message: {
							content: "Default response",
						},
					},
				],
			};
			mockResponse.json.mockResolvedValue(mockResponseData);

			await groqLLM.autocomplete("System prompt", "User input");

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://api.groq.com/openai/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "llama2-70b-4096",
						messages: [
							{ role: "system", content: "System prompt" },
							{ role: "user", content: "User input" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should handle userPrompt correctly", async () => {
			const mockResponseData = {
				choices: [
					{
						message: {
							content: "Response with user prompt",
						},
					},
				],
			};
			mockResponse.json.mockResolvedValue(mockResponseData);

			await groqLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://api.groq.com/openai/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "llama2-70b-4096",
						messages: [
							{ role: "system", content: "System instruction" },
							{ role: "user", content: "User custom prompt" },
							{ role: "user", content: "Content text" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should handle empty response gracefully", async () => {
			const mockResponseData = { choices: [] };
			mockResponse.json.mockResolvedValue(mockResponseData);

			const result = await groqLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponseData = { choices: [{ message: null }] };
			mockResponse.json.mockResolvedValue(mockResponseData);

			const result = await groqLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should propagate API errors with custom message", async () => {
			mockResponse.ok = false;
			mockResponse.status = 429;
			mockResponse.statusText = "Too Many Requests";

			await expect(
				groqLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Groq API error: 429 Too Many Requests");
		});

		it("should call callback with full result in non-streaming mode", async () => {
			const mockResponseData = {
				choices: [
					{
						message: {
							content: "Full response text",
						},
					},
				],
			};
			mockResponse.json.mockResolvedValue(mockResponseData);

			const callback = jest.fn();
			const result = await groqLLM.autocomplete(
				"prompt",
				"content",
				callback
			);

			expect(result).toBe("Full response text");
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("Full response text");
		});

		it("should not call callback in non-streaming mode when result is empty", async () => {
			const mockResponseData = { choices: [] };
			mockResponse.json.mockResolvedValue(mockResponseData);

			const callback = jest.fn();
			const result = await groqLLM.autocomplete(
				"prompt",
				"content",
				callback
			);

			expect(result).toBe("");
			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe("streaming functionality", () => {
		let mockReader: MockReader;

		beforeEach(() => {
			mockReader = {
				read: jest.fn(),
				releaseLock: jest.fn(),
			};

			mockResponse.body = {
				getReader: jest.fn().mockReturnValue(mockReader),
			};
		});

		it("should successfully stream completion", async () => {
			const streamData = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const callback = jest.fn();
			await groqLLM.autocomplete(
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
				"https://api.groq.com/openai/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "llama2-70b-4096",
						messages: [
							{ role: "system", content: "You are helpful" },
							{ role: "user", content: "Say hello" },
						],
						temperature: 0.8,
						max_tokens: 500,
						stream: true,
					}),
				})
			);
		});

		it("should handle streaming with userPrompt", async () => {
			const streamData = [
				'data: {"choices":[{"delta":{"content":"Response"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" text"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const callback = jest.fn();
			await groqLLM.autocomplete(
				"System instruction",
				"Content text",
				callback,
				0.7,
				1000,
				"User custom prompt",
				true
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"https://api.groq.com/openai/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "llama2-70b-4096",
						messages: [
							{ role: "system", content: "System instruction" },
							{ role: "user", content: "User custom prompt" },
							{ role: "user", content: "Content text" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: true,
					}),
				})
			);
		});

		it("should handle invalid JSON in stream gracefully", async () => {
			const streamData = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				"data: invalid json\n\n",
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const callback = jest.fn();
			await groqLLM.autocomplete(
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
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");
		});

		it("should handle empty streaming chunks gracefully", async () => {
			const streamData = [
				'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
				'data: {"choices":[]}\n\n', // Empty choices
				'data: {"choices":[{"delta":{}}]}\n\n', // Empty delta
				'data: {"choices":[{"delta":{"content":""}}]}\n\n', // Empty content
				"data: [DONE]\n\n",
			];

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const callback = jest.fn();
			await groqLLM.autocomplete(
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

		it("should handle missing response body reader", async () => {
			mockResponse.body = undefined;

			const callback = jest.fn();

			await expect(
				groqLLM.autocomplete(
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

		it("should release reader lock on completion", async () => {
			const streamData = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const callback = jest.fn();
			await groqLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			expect(mockReader.releaseLock).toHaveBeenCalled();
		});

		it("should release reader lock on error", async () => {
			mockReader.read.mockRejectedValue(new Error("Stream error"));

			const callback = jest.fn();

			await expect(
				groqLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Stream error");

			expect(mockReader.releaseLock).toHaveBeenCalled();
		});

		it("should have identical final result for streaming and non-streaming modes", async () => {
			const expectedText = "Hello world response";

			// Setup non-streaming mock
			const mockNonStreamingData = {
				choices: [
					{
						message: {
							content: expectedText,
						},
					},
				],
			};

			// Setup streaming mock
			const streamData = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" response"}}]}\n\n',
				"data: [DONE]\n\n",
			];

			// Test non-streaming mode
			mockResponse.json.mockResolvedValue(mockNonStreamingData);
			const nonStreamingCallback = jest.fn();
			const nonStreamingResult = await groqLLM.autocomplete(
				"Test prompt",
				"Test content",
				nonStreamingCallback,
				0.7,
				1000,
				undefined,
				false
			);

			// Save callback call info before clearing mocks
			const nonStreamingCallCount =
				nonStreamingCallback.mock.calls.length;
			const nonStreamingCallArgs =
				nonStreamingCallback.mock.calls[0]?.[0];

			// Reset and setup streaming mode
			jest.clearAllMocks();
			mockStandardFetch.mockResolvedValue(mockResponse);
			mockNativeFetch.mockResolvedValue(mockResponse);

			let dataIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (dataIndex < streamData.length) {
					const value = new TextEncoder().encode(
						streamData[dataIndex]
					);
					dataIndex++;
					return Promise.resolve({ done: false, value });
				}
				return Promise.resolve({ done: true, value: undefined });
			});

			const streamingCallback = jest.fn();
			let streamingResult = "";
			const mockStreamingCallbackWrapper = (chunk: string) => {
				streamingResult += chunk;
				streamingCallback(chunk);
			};

			await groqLLM.autocomplete(
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
			expect(nonStreamingCallCount).toBe(1);
			expect(nonStreamingCallArgs).toBe(expectedText);

			expect(streamingCallback).toHaveBeenCalledTimes(3);
			expect(streamingCallback).toHaveBeenNthCalledWith(1, "Hello");
			expect(streamingCallback).toHaveBeenNthCalledWith(2, " world");
			expect(streamingCallback).toHaveBeenNthCalledWith(3, " response");
		});
	});

	describe("edge cases and error scenarios", () => {
		it("should handle network errors gracefully", async () => {
			const networkError = new Error("Network connection failed");
			mockStandardFetch.mockRejectedValue(networkError);
			mockNativeFetch.mockRejectedValue(networkError);

			await expect(
				groqLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Network connection failed");
		});

		it("should handle authentication errors", async () => {
			mockResponse.ok = false;
			mockResponse.status = 401;
			mockResponse.statusText = "Unauthorized";

			await expect(
				groqLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Groq API error: 401 Unauthorized");
		});

		it("should handle rate limit errors", async () => {
			mockResponse.ok = false;
			mockResponse.status = 429;
			mockResponse.statusText = "Too Many Requests";

			await expect(
				groqLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Groq API error: 429 Too Many Requests");
		});

		it("should handle server errors", async () => {
			mockResponse.ok = false;
			mockResponse.status = 500;
			mockResponse.statusText = "Internal Server Error";

			await expect(
				groqLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Groq API error: 500 Internal Server Error");
		});

		it("should handle streaming API errors", async () => {
			mockResponse.ok = false;
			mockResponse.status = 503;
			mockResponse.statusText = "Service Unavailable";

			const callback = jest.fn();

			await expect(
				groqLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Groq API error: 503 Service Unavailable");
		});
	});

	describe("model configuration", () => {
		it("should handle different Groq models correctly", () => {
			const models = [
				"llama2-70b-4096",
				"mixtral-8x7b-32768",
				"gemma-7b-it",
			];

			models.forEach(modelName => {
				const modelLLM = new GroqLLM(mockProvider, modelName, false);
				expect(modelLLM).toBeDefined();
				expect(modelLLM["modelName"]).toBe(modelName);
			});
		});

		it("should handle custom provider URLs", () => {
			const customProvider = {
				...mockProvider,
				url: "https://custom-groq-endpoint.com/v1",
			};

			const customGroqLLM = new GroqLLM(
				customProvider,
				"llama2-70b-4096",
				false
			);
			expect(customGroqLLM["getBaseUrl"]()).toBe(
				"https://custom-groq-endpoint.com/v1"
			);
		});

		it("should handle providers without API key", () => {
			const providerWithoutKey = { ...mockProvider };
			delete providerWithoutKey.apiKey;

			const groqWithoutKey = new GroqLLM(
				providerWithoutKey,
				"llama2-70b-4096",
				false
			);
			expect(groqWithoutKey).toBeDefined();

			const headers = groqWithoutKey["getHeaders"]();
			expect(headers["Authorization"]).toBeUndefined();
		});
	});
});
