import { LMStudioLLM } from "./lmstudio_llm";
import type { AIProvider } from "../types";
import { nativeFetch, standardFetch } from "../utils/fetch";
import { TextDecoder, TextEncoder } from "util";

// Setup TextDecoder and TextEncoder for Node.js test environment
Object.assign(globalThis, {
	TextDecoder,
	TextEncoder,
});

// Mock the fetch functions
jest.mock("../utils/fetch", () => ({
	nativeFetch: jest.fn(),
	standardFetch: jest.fn(),
}));

describe("LMStudioLLM", () => {
	let lmstudioLLM: LMStudioLLM;
	let mockProvider: AIProvider;
	let mockFetch: jest.Mock;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-lmstudio",
			name: "Test LMStudio",
			type: "lmstudio",
			apiKey: "test-api-key",
			url: "http://localhost:1234/v1",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create LMStudioLLM instance
		lmstudioLLM = new LMStudioLLM(mockProvider, "test-model", false);

		// Mock the fetch function
		mockFetch = standardFetch as jest.Mock;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(lmstudioLLM).toBeDefined();
			expect(lmstudioLLM["modelName"]).toBe("test-model");
			expect(lmstudioLLM["provider"]).toEqual(mockProvider);
		});

		it("should set useNativeFetch correctly", () => {
			const lmstudioWithNativeFetch = new LMStudioLLM(
				mockProvider,
				"test-model",
				true
			);
			expect(lmstudioWithNativeFetch).toBeDefined();
			expect(lmstudioWithNativeFetch["useNativeFetch"]).toBe(true);
		});

		it("should use default base URL when provider URL is not set", () => {
			const providerWithoutUrl = {
				...mockProvider,
				url: undefined,
			};
			const lmstudioWithDefaultUrl = new LMStudioLLM(
				providerWithoutUrl,
				"test-model"
			);
			expect(lmstudioWithDefaultUrl["getBaseUrl"]()).toBe(
				"http://localhost:1234/v1"
			);
		});
	});

	describe("getHeaders", () => {
		it("should include authorization header when API key is provided", () => {
			const headers = lmstudioLLM["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
				Authorization: "Bearer test-api-key",
			});
		});

		it("should not include authorization header when API key is not provided", () => {
			const providerWithoutKey = {
				...mockProvider,
				apiKey: undefined,
			};
			const lmstudioWithoutKey = new LMStudioLLM(
				providerWithoutKey,
				"test-model"
			);
			const headers = lmstudioWithoutKey["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
			});
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Generated completion text",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await lmstudioLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
					},
					body: JSON.stringify({
						model: "test-model",
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

		it("should use default temperature and maxOutputTokens when not provided", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Default response",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete("System prompt", "User input");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
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

		it("should handle empty response gracefully", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({ choices: [] }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await lmstudioLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [{ message: { content: null } }],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await lmstudioLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should propagate API errors", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			};
			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				lmstudioLLM.autocomplete("prompt", "content")
			).rejects.toThrow("LMStudio API error: 500 Internal Server Error");
		});

		it("should handle userPrompt correctly", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Response with user prompt",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
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

		it("should handle zero and negative maxOutputTokens correctly", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Response",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			// Test with zero maxOutputTokens
			await lmstudioLLM.autocomplete(
				"prompt",
				"content",
				undefined,
				0.7,
				0
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "system", content: "prompt" },
							{ role: "user", content: "content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);

			// Test with negative maxOutputTokens
			await lmstudioLLM.autocomplete(
				"prompt",
				"content",
				undefined,
				0.7,
				-100
			);

			expect(mockFetch).toHaveBeenLastCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "system", content: "prompt" },
							{ role: "user", content: "content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should not call callback in non-streaming mode when result is empty", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({ choices: [] }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await lmstudioLLM.autocomplete(
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

		it("should call callback with full result in non-streaming mode", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Full response text",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await lmstudioLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				false
			);

			expect(result).toBe("Full response text");
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("Full response text");
		});
	});

	describe("streaming functionality", () => {
		it("should successfully stream completion", async () => {
			const mockReader = {
				read: jest
					.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"Hello"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":" world"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"!"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("data: [DONE]\n"),
					})
					.mockResolvedValueOnce({ done: true, value: undefined }),
				releaseLock: jest.fn(),
			};

			const mockResponse = {
				ok: true,
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await lmstudioLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				500,
				undefined,
				true
			);

			expect(result).toBeUndefined();
			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");
			expect(callback).toHaveBeenNthCalledWith(3, "!");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
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

		it("should handle streaming errors", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();

			await expect(
				lmstudioLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("LMStudio API error: 500 Internal Server Error");
		});

		it("should handle missing response body reader", async () => {
			const mockResponse = {
				ok: true,
				body: null,
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();

			await expect(
				lmstudioLLM.autocomplete(
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

		it("should handle empty streaming chunks gracefully", async () => {
			const mockReader = {
				read: jest
					.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"valid"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("data: {}\n"), // Empty data
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[]}\n'
						), // Empty choices
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("invalid json\n"), // Invalid JSON
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("data: [DONE]\n"),
					})
					.mockResolvedValueOnce({ done: true, value: undefined }),
				releaseLock: jest.fn(),
			};

			const mockResponse = {
				ok: true,
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			await lmstudioLLM.autocomplete(
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

		it("should handle streaming with reader error", async () => {
			const mockReader = {
				read: jest.fn().mockRejectedValue(new Error("Reader error")),
				releaseLock: jest.fn(),
			};

			const mockResponse = {
				ok: true,
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();

			await expect(
				lmstudioLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Reader error");

			expect(mockReader.releaseLock).toHaveBeenCalled();
		});

		it("should return void for streaming mode", async () => {
			const mockReader = {
				read: jest
					.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"test"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("data: [DONE]\n"),
					})
					.mockResolvedValueOnce({ done: true, value: undefined }),
				releaseLock: jest.fn(),
			};

			const mockResponse = {
				ok: true,
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await lmstudioLLM.autocomplete(
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
			mockFetch.mockRejectedValue(networkError);

			await expect(
				lmstudioLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Network connection failed");
		});

		it("should handle authentication errors", async () => {
			const mockResponse = {
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			};
			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				lmstudioLLM.autocomplete("prompt", "content")
			).rejects.toThrow("LMStudio API error: 401 Unauthorized");
		});

		it("should handle rate limit errors", async () => {
			const mockResponse = {
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			await expect(
				lmstudioLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("LMStudio API error: 429 Too Many Requests");
		});

		it("should handle JSON parsing errors in non-streaming mode", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				lmstudioLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Invalid JSON");
		});
	});

	describe("nativeFetch usage", () => {
		it("should use nativeFetch when enabled", async () => {
			const mockNativeFetch = nativeFetch as jest.Mock;

			const lmstudioWithNativeFetch = new LMStudioLLM(
				mockProvider,
				"test-model",
				true
			);

			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Native fetch response",
							},
						},
					],
				}),
			};
			mockNativeFetch.mockResolvedValue(mockResponse);

			const result = await lmstudioWithNativeFetch.autocomplete(
				"prompt",
				"content"
			);

			expect(result).toBe("Native fetch response");
			expect(mockNativeFetch).toHaveBeenCalled();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("systemPromptSupport functionality", () => {
		it("should use system role when systemPromptSupport is true", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Response with system role",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete(
				"System instruction",
				"User content",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				true
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "system", content: "System instruction" },
							{ role: "user", content: "User content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should use user role when systemPromptSupport is false", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Response with user role",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete(
				"System instruction",
				"User content",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				false
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "user", content: "System instruction" },
							{ role: "user", content: "User content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should default to system role when systemPromptSupport is undefined", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content: "Response with default system role",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete(
				"System instruction",
				"User content",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				undefined
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "system", content: "System instruction" },
							{ role: "user", content: "User content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: false,
					}),
				})
			);
		});

		it("should handle systemPromptSupport with userPrompt correctly", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					choices: [
						{
							message: {
								content:
									"Response with user prompt and system support false",
							},
						},
					],
				}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await lmstudioLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt",
				false,
				false
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "user", content: "System instruction" },
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

		it("should work with streaming mode and systemPromptSupport", async () => {
			const mockReader = {
				read: jest
					.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":"Streaming"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(
							'data: {"choices":[{"delta":{"content":" response"}}]}\n'
						),
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode("data: [DONE]\n"),
					})
					.mockResolvedValueOnce({ done: true, value: undefined }),
				releaseLock: jest.fn(),
			};

			const mockResponse = {
				ok: true,
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			};
			mockFetch.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			await lmstudioLLM.autocomplete(
				"System instruction",
				"User content",
				callback,
				undefined,
				undefined,
				undefined,
				true,
				false
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:1234/v1/chat/completions",
				expect.objectContaining({
					body: JSON.stringify({
						model: "test-model",
						messages: [
							{ role: "user", content: "System instruction" },
							{ role: "user", content: "User content" },
						],
						temperature: 0.7,
						max_tokens: 1000,
						stream: true,
					}),
				})
			);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Streaming");
			expect(callback).toHaveBeenNthCalledWith(2, " response");
		});
	});
});
