import { OllamaLLM } from "./ollama_llm";
import type { AIProvider } from "../types";
import { nativeFetch, standardFetch } from "../utils/fetch";
import { TextDecoder, TextEncoder } from "util";
import {
	MockResponse,
	createMockResponse,
	createMockStreamReader,
} from "../../__mocks__/response";
import type { MockReadableStreamReader } from "../../__mocks__/response";

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

const mockNativeFetch = nativeFetch as jest.MockedFunction<typeof nativeFetch>;
const mockStandardFetch = standardFetch as jest.MockedFunction<
	typeof standardFetch
>;

describe("OllamaLLM", () => {
	let ollamaLLM: OllamaLLM;
	let mockProvider: AIProvider;
	let mockResponse: MockResponse;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-ollama",
			name: "Test Ollama",
			type: "ollama",
			apiKey: "",
			url: "http://localhost:11434",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create mock response
		mockResponse = createMockResponse({
			ok: true,
			status: 200,
			statusText: "OK",
		});

		// Create OllamaLLM instance
		ollamaLLM = new OllamaLLM(mockProvider, "llama2", false);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(ollamaLLM).toBeDefined();
			expect(ollamaLLM["modelName"]).toBe("llama2");
			expect(ollamaLLM["provider"]).toBe(mockProvider);
		});

		it("should set useNativeFetch correctly", () => {
			const ollamaWithNativeFetch = new OllamaLLM(
				mockProvider,
				"llama2",
				true
			);
			expect(ollamaWithNativeFetch["useNativeFetch"]).toBe(true);
		});

		it("should default useNativeFetch to false", () => {
			const ollamaDefault = new OllamaLLM(mockProvider, "llama2");
			expect(ollamaDefault["useNativeFetch"]).toBe(false);
		});
	});

	describe("getDefaultBaseUrl", () => {
		it("should return correct default base URL", () => {
			const defaultUrl = ollamaLLM["getDefaultBaseUrl"]();
			expect(defaultUrl).toBe("http://localhost:11434");
		});
	});

	describe("getHeaders", () => {
		it("should return correct headers without Authorization", () => {
			const headers = ollamaLLM["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
			});
		});

		it("should not include Authorization header even with API key", () => {
			const providerWithKey = { ...mockProvider, apiKey: "test-key" };
			const ollamaWithKey = new OllamaLLM(
				providerWithKey,
				"llama2",
				false
			);
			const headers = ollamaWithKey["getHeaders"]();
			expect(headers).toEqual({
				"Content-Type": "application/json",
			});
		});
	});

	describe("autocomplete", () => {
		beforeEach(() => {
			// Setup default mock behavior
			mockStandardFetch.mockResolvedValue(mockResponse as Response);
			mockNativeFetch.mockResolvedValue(mockResponse as Response);
		});

		it("should successfully generate completion", async () => {
			const mockResponseData = {
				response: "Generated completion text",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			const result = await ollamaLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "Write a hello world function",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "You are a helpful assistant",
					}),
				}
			);
		});

		it("should handle userPrompt correctly", async () => {
			const mockResponseData = {
				response: "Response with user prompt",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt"
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User custom prompt\nContent text",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "System instruction",
					}),
				}
			);
		});

		it("should use default temperature and maxOutputTokens when not provided", async () => {
			const mockResponseData = {
				response: "Default response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete("System prompt", "User input");

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User input",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "System prompt",
					}),
				}
			);
		});

		it("should handle zero maxOutputTokens correctly", async () => {
			const mockResponseData = {
				response: "Response with default tokens",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"System prompt",
				"User input",
				undefined,
				0.5,
				0
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User input",
						stream: false,
						options: {
							temperature: 0.5,
							num_predict: 1000,
						},
						system: "System prompt",
					}),
				}
			);
		});

		it("should handle empty response gracefully", async () => {
			const mockResponseData = { response: "", done: true };
			mockResponse.setJsonResponse(mockResponseData);

			const result = await ollamaLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle missing response field gracefully", async () => {
			const mockResponseData = { done: true };
			mockResponse.setJsonResponse(mockResponseData);

			const result = await ollamaLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should call callback with the full result in non-streaming mode", async () => {
			const mockResponseData = {
				response: "Full response text",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			const callback = jest.fn();
			const result = await ollamaLLM.autocomplete(
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

		it("should not call callback in non-streaming mode when result is empty", async () => {
			const mockResponseData = { response: "", done: true };
			mockResponse.setJsonResponse(mockResponseData);

			const callback = jest.fn();
			const result = await ollamaLLM.autocomplete(
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

		it("should use native fetch when useNativeFetch is true", async () => {
			const ollamaWithNativeFetch = new OllamaLLM(
				mockProvider,
				"llama2",
				true
			);
			const mockResponseData = { response: "Native fetch response" };
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaWithNativeFetch.autocomplete("prompt", "content");

			expect(mockNativeFetch).toHaveBeenCalled();
			expect(mockStandardFetch).not.toHaveBeenCalled();
		});

		it("should throw error on non-ok response", async () => {
			mockResponse.ok = false;
			mockResponse.status = 400;
			mockResponse.statusText = "Bad Request";

			await expect(
				ollamaLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Ollama API error: 400 Bad Request");
		});

		it("should handle network errors", async () => {
			const networkError = new Error("Network connection failed");
			mockStandardFetch.mockRejectedValue(networkError);

			await expect(
				ollamaLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Network connection failed");
		});
	});

	describe("streaming mode", () => {
		let mockReader: MockReadableStreamReader;

		beforeEach(() => {
			mockReader = createMockStreamReader();
			mockResponse.setStreamReader(mockReader);
			mockStandardFetch.mockResolvedValue(mockResponse as Response);
		});

		it("should handle streaming mode successfully", async () => {
			// Mock streaming chunks
			const chunks = [
				'{"response": "Hello", "done": false}\n',
				'{"response": " world", "done": false}\n',
				'{"response": "!", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"System prompt",
				"User input",
				callback,
				0.7,
				1000,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");
			expect(callback).toHaveBeenNthCalledWith(3, "!");
			expect(mockReader.releaseLock).toHaveBeenCalled();

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User input",
						stream: true,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "System prompt",
					}),
				}
			);
		});

		it("should handle streaming with done flag", async () => {
			const chunks = [
				'{"response": "Complete", "done": false}\n',
				'{"done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith("Complete");
		});

		it("should handle invalid JSON in stream gracefully", async () => {
			const chunks = [
				'{"response": "Valid", "done": false}\n',
				"invalid json line\n",
				'{"response": " text", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			// Should skip invalid JSON and process valid chunks
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Valid");
			expect(callback).toHaveBeenNthCalledWith(2, " text");
		});

		it("should handle incomplete JSON chunks across reads", async () => {
			const chunks = [
				'{"response": "Partial',
				' chunk", "done": false}\n{"response": " more", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Partial chunk");
			expect(callback).toHaveBeenNthCalledWith(2, " more");
		});

		it("should throw error when no reader is available", async () => {
			mockResponse.body = null;

			const callback = jest.fn();
			await expect(
				ollamaLLM.autocomplete(
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

		it("should ensure reader is released on error", async () => {
			mockReader.read.mockRejectedValue(new Error("Read error"));

			const callback = jest.fn();
			await expect(
				ollamaLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Read error");

			expect(mockReader.releaseLock).toHaveBeenCalled();
		});

		it("should handle empty stream chunks gracefully", async () => {
			const chunks = [
				'{"response": "Start", "done": false}\n',
				"\n", // Empty line
				"   \n", // Whitespace only
				'{"response": " End", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Start");
			expect(callback).toHaveBeenNthCalledWith(2, " End");
		});

		it("should handle streaming error on non-ok response", async () => {
			mockResponse.ok = false;
			mockResponse.status = 500;
			mockResponse.statusText = "Internal Server Error";

			const callback = jest.fn();
			await expect(
				ollamaLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Ollama API error: 500 Internal Server Error");
		});
	});

	describe("systemPromptSupport parameter", () => {
		beforeEach(() => {
			mockStandardFetch.mockResolvedValue(mockResponse as Response);
		});

		it("should use system parameter in API when systemPromptSupport is true", async () => {
			const mockResponseData = {
				response: "System prompt response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				true
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "Write a hello world function",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "You are a helpful assistant",
					}),
				}
			);
		});

		it("should add prompt as part of user prompt when systemPromptSupport is false", async () => {
			const mockResponseData = {
				response: "User prompt response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				false
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "You are a helpful assistant\nWrite a hello world function",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
					}),
				}
			);
		});

		it("should handle userPrompt with systemPromptSupport true", async () => {
			const mockResponseData = {
				response: "Combined prompt response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt",
				false,
				true
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User custom prompt\nContent text",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "System instruction",
					}),
				}
			);
		});

		it("should handle userPrompt with systemPromptSupport false", async () => {
			const mockResponseData = {
				response: "User prompt response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				1000,
				"User custom prompt",
				false,
				false
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "System instruction\nUser custom prompt\nContent text",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
					}),
				}
			);
		});

		it("should default to systemPromptSupport true when parameter is not provided", async () => {
			const mockResponseData = {
				response: "Default system prompt response",
				done: true,
			};
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "Write a hello world function",
						stream: false,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "You are a helpful assistant",
					}),
				}
			);
		});

		it("should work with streaming mode and systemPromptSupport true", async () => {
			const mockReader = createMockStreamReader();
			mockResponse.setStreamReader(mockReader);

			const chunks = [
				'{"response": "System", "done": false}\n',
				'{"response": " prompt", "done": false}\n',
				'{"response": " streaming", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"System prompt",
				"User input",
				callback,
				0.7,
				1000,
				undefined,
				true,
				true
			);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "System");
			expect(callback).toHaveBeenNthCalledWith(2, " prompt");
			expect(callback).toHaveBeenNthCalledWith(3, " streaming");

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "User input",
						stream: true,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
						system: "System prompt",
					}),
				}
			);
		});

		it("should work with streaming mode and systemPromptSupport false", async () => {
			const mockReader = createMockStreamReader();
			mockResponse.setStreamReader(mockReader);

			const chunks = [
				'{"response": "User", "done": false}\n',
				'{"response": " prompt", "done": false}\n',
				'{"response": " streaming", "done": true}\n',
			];

			let chunkIndex = 0;
			mockReader.read.mockImplementation(() => {
				if (chunkIndex < chunks.length) {
					const chunk = chunks[chunkIndex++];
					return Promise.resolve({
						done: false,
						value: new TextEncoder().encode(chunk),
					});
				}
				return Promise.resolve({ done: true });
			});

			const callback = jest.fn();
			await ollamaLLM.autocomplete(
				"System prompt",
				"User input",
				callback,
				0.7,
				1000,
				undefined,
				true,
				false
			);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "User");
			expect(callback).toHaveBeenNthCalledWith(2, " prompt");
			expect(callback).toHaveBeenNthCalledWith(3, " streaming");

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama2",
						prompt: "System prompt\nUser input",
						stream: true,
						options: {
							temperature: 0.7,
							num_predict: 1000,
						},
					}),
				}
			);
		});
	});

	describe("edge cases and error scenarios", () => {
		beforeEach(() => {
			mockStandardFetch.mockResolvedValue(mockResponse as Response);
		});

		it("should handle custom provider URL", () => {
			const customProvider = {
				...mockProvider,
				url: "http://custom-ollama:11434",
			};
			const customOllama = new OllamaLLM(customProvider, "llama2");
			const baseUrl = customOllama["getBaseUrl"]();
			expect(baseUrl).toBe("http://custom-ollama:11434");
		});

		it("should handle undefined temperature correctly", async () => {
			const mockResponseData = { response: "Test response" };
			mockResponse.setJsonResponse(mockResponseData);

			await ollamaLLM.autocomplete(
				"prompt",
				"content",
				undefined,
				undefined,
				1000
			);

			expect(mockStandardFetch).toHaveBeenCalledWith(
				"http://localhost:11434/api/generate",
				expect.objectContaining({
					body: expect.stringContaining('"temperature":0.7'),
				})
			);
		});
	});
});
