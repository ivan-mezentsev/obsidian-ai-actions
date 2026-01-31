import { GeminiLLM } from "./gemini_llm";
import type { AIProvider } from "../types";

type MockGeminiClient = {
	models: {
		generateContent: jest.Mock;
		generateContentStream: jest.Mock;
	};
};

// Mock the Google GenAI SDK
jest.mock("@google/genai", () => ({
	GoogleGenAI: jest.fn().mockImplementation(() => ({
		models: {
			generateContent: jest.fn(),
			generateContentStream: jest.fn(),
		},
	})),
}));

describe("GeminiLLM", () => {
	let geminiLLM: GeminiLLM;
	let mockProvider: AIProvider;
	let mockClient: MockGeminiClient;

	beforeEach(() => {
		// Create a mock provider
		mockProvider = {
			id: "test-gemini",
			name: "Test Gemini",
			type: "gemini",
			apiKey: "test-api-key",
			url: "https://generativelanguage.googleapis.com/v1beta",
		};

		// Reset all mocks
		jest.clearAllMocks();

		// Create GeminiLLM instance
		geminiLLM = new GeminiLLM(mockProvider, "gemini-1.5-pro", false);

		// Get the mock client
		mockClient = geminiLLM["client"] as unknown as MockGeminiClient;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(geminiLLM).toBeDefined();
			expect(geminiLLM["modelName"]).toBe("gemini-1.5-pro");
		});

		it("should set useNativeFetch correctly", () => {
			const geminiWithNativeFetch = new GeminiLLM(
				mockProvider,
				"gemini-1.5-pro",
				true
			);
			expect(geminiWithNativeFetch).toBeDefined();
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate completion", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Generated completion text",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000
			);

			expect(result).toBe("Generated completion text");
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "You are a helpful assistant",
				},
			});
		});

		it("should use default temperature and maxOutputTokens when not provided", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Default response",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			await geminiLLM.autocomplete("System prompt", "User input");

			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [{ role: "user", parts: [{ text: "User input" }] }],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "System prompt",
				},
			});
		});

		it("should handle empty response gracefully", async () => {
			const mockResponse = { candidates: [] };
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should handle malformed response gracefully", async () => {
			const mockResponse = { candidates: [{ content: null }] };
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete("prompt", "content");
			expect(result).toBe("");
		});

		it("should propagate API errors with custom message", async () => {
			const apiError = new Error("API rate limit exceeded");
			mockClient.models.generateContent.mockRejectedValue(apiError);

			await expect(
				geminiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Gemini SDK error: API rate limit exceeded");
		});

		it("should handle unknown errors", async () => {
			mockClient.models.generateContent.mockRejectedValue(
				"Unknown error"
			);

			await expect(
				geminiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Gemini SDK error: Unknown error");
		});

		it("should have identical final result for streaming and non-streaming modes", async () => {
			const expectedText = "Hello world response";

			// Setup mocks for both modes to return the same final result
			const mockNonStreamingResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: expectedText,
								},
							],
						},
					},
				],
			};

			const mockStreamingResponse = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					// Simulate streaming the same text in chunks
					yield {
						candidates: [
							{ content: { parts: [{ text: "Hello" }] } },
						],
					};
					yield {
						candidates: [
							{ content: { parts: [{ text: " world" }] } },
						],
					};
					yield {
						candidates: [
							{ content: { parts: [{ text: " response" }] } },
						],
					};
				},
			};

			// Test non-streaming mode
			mockClient.models.generateContent.mockResolvedValue(
				mockNonStreamingResponse
			);
			const nonStreamingCallback = jest.fn();
			const nonStreamingResult = await geminiLLM.autocomplete(
				"Test prompt",
				"Test content",
				nonStreamingCallback,
				0.7,
				1000,
				undefined,
				false
			);

			// Test streaming mode
			mockClient.models.generateContentStream.mockResolvedValue(
				mockStreamingResponse
			);
			const streamingCallback = jest.fn();
			let streamingResult = "";
			const mockStreamingCallbackWrapper = (chunk: string) => {
				streamingResult += chunk;
				streamingCallback(chunk);
			};

			await geminiLLM.autocomplete(
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
			const mockResponse = { candidates: [] };
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const callback = jest.fn();
			const result = await geminiLLM.autocomplete(
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
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Hello",
										},
									],
								},
							},
						],
					};
					yield {
						candidates: [
							{
								content: {
									parts: [
										{
											text: " world",
										},
									],
								},
							},
						],
					};
					yield {
						candidates: [
							{
								content: {
									parts: [
										{
											text: "!",
										},
									],
								},
							},
						],
					};
				},
			};
			mockClient.models.generateContentStream.mockResolvedValue(
				mockStream
			);

			const callback = jest.fn();
			await geminiLLM.autocomplete(
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

			expect(
				mockClient.models.generateContentStream
			).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
				config: {
					temperature: 0.8,
					maxOutputTokens: 500,
					systemInstruction: "You are helpful",
				},
			});
		});

		it("should handle userPrompt with system instruction for supported models", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Response with user prompt",
										},
									],
								},
							},
						],
					};
				},
			};
			mockClient.models.generateContentStream.mockResolvedValue(
				mockStream
			);

			const callback = jest.fn();
			await geminiLLM.autocomplete(
				"System instruction",
				"Content text",
				callback,
				0.7,
				1000,
				"User custom prompt",
				true
			);

			expect(
				mockClient.models.generateContentStream
			).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{ role: "user", parts: [{ text: "User custom prompt" }] },
					{ role: "user", parts: [{ text: "Content text" }] },
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "System instruction",
				},
			});
		});

		it("should handle streaming errors", async () => {
			const streamError = new Error("Streaming connection failed");
			mockClient.models.generateContentStream.mockRejectedValue(
				streamError
			);

			const callback = jest.fn();

			await expect(
				geminiLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Gemini SDK error: Streaming connection failed");
		});

		it("should handle empty streaming chunks gracefully", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						candidates: [
							{ content: { parts: [{ text: "valid" }] } },
						],
					};
					yield { candidates: [] }; // Empty candidates
					yield { candidates: [{ content: null }] }; // Null content
					yield { candidates: [{ content: { parts: [] } }] }; // Empty parts
				},
			};
			mockClient.models.generateContentStream.mockResolvedValue(
				mockStream
			);

			const callback = jest.fn();
			await geminiLLM.autocomplete(
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
			mockClient.models.generateContent.mockRejectedValue(networkError);

			await expect(
				geminiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Gemini SDK error: Network connection failed");
		});

		it("should handle authentication errors", async () => {
			const authError = new Error("Invalid API key");
			mockClient.models.generateContent.mockRejectedValue(authError);

			await expect(
				geminiLLM.autocomplete("prompt", "content")
			).rejects.toThrow("Gemini SDK error: Invalid API key");
		});

		it("should handle rate limit errors", async () => {
			const rateLimitError = new Error("Rate limit exceeded");
			mockClient.models.generateContentStream.mockRejectedValue(
				rateLimitError
			);

			const callback = jest.fn();
			await expect(
				geminiLLM.autocomplete(
					"prompt",
					"content",
					callback,
					undefined,
					undefined,
					undefined,
					true
				)
			).rejects.toThrow("Gemini SDK error: Rate limit exceeded");
		});
	});

	describe("systemPromptSupport parameter", () => {
		it("should use systemInstruction when systemPromptSupport is true (default)", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Response with system instruction",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				true
			);

			expect(result).toBe("Response with system instruction");
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "You are a helpful assistant",
				},
			});
		});

		it("should not use systemInstruction when systemPromptSupport is false", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Response without system instruction",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				undefined,
				false,
				false
			);

			expect(result).toBe("Response without system instruction");
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "You are a helpful assistant" }],
					},
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
				},
			});
		});

		it("should use systemInstruction with userPrompt when systemPromptSupport is true", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Response with user prompt and system instruction",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				"Custom user prompt",
				false,
				true
			);

			expect(result).toBe(
				"Response with user prompt and system instruction"
			);
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "Custom user prompt" }],
					},
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "You are a helpful assistant",
				},
			});
		});

		it("should not use systemInstruction with userPrompt when systemPromptSupport is false", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Response with user prompt but no system instruction",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7,
				1000,
				"Custom user prompt",
				false,
				false
			);

			expect(result).toBe(
				"Response with user prompt but no system instruction"
			);
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "You are a helpful assistant" }],
					},
					{
						role: "user",
						parts: [{ text: "Custom user prompt" }],
					},
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
				},
			});
		});

		it("should handle systemPromptSupport in streaming mode", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Streaming with system instruction",
										},
									],
								},
							},
						],
					};
				},
			};
			mockClient.models.generateContentStream.mockResolvedValue(
				mockStream
			);

			const callback = jest.fn();
			await geminiLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				500,
				undefined,
				true,
				true
			);

			expect(callback).toHaveBeenCalledWith(
				"Streaming with system instruction"
			);
			expect(
				mockClient.models.generateContentStream
			).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
				config: {
					temperature: 0.8,
					maxOutputTokens: 500,
					systemInstruction: "You are helpful",
				},
			});
		});

		it("should default to systemPromptSupport=true when parameter is undefined", async () => {
			const mockResponse = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Default system instruction behavior",
								},
							],
						},
					},
				],
			};
			mockClient.models.generateContent.mockResolvedValue(mockResponse);

			const result = await geminiLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function"
			);

			expect(result).toBe("Default system instruction behavior");
			expect(mockClient.models.generateContent).toHaveBeenCalledWith({
				model: "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: [{ text: "Write a hello world function" }],
					},
				],
				config: {
					temperature: 0.7,
					maxOutputTokens: 1000,
					systemInstruction: "You are a helpful assistant",
				},
			});
		});
	});

	describe("Gemma model handling with systemPromptSupport", () => {
		let gemmaLLM: GeminiLLM;
		let gemmaMockClient: MockGeminiClient;

		beforeEach(() => {
			gemmaLLM = new GeminiLLM(mockProvider, "gemma-7b-it", false);
			gemmaMockClient = gemmaLLM["client"] as unknown as MockGeminiClient;

			// Setup mock to throw error for Gemma models with systemInstruction
			gemmaMockClient.models.generateContent.mockImplementation(
				(request: {
					model?: string;
					config?: { systemInstruction?: string };
				}) => {
					if (
						request.model &&
						request.model.toLowerCase().includes("gemma") &&
						request.config?.systemInstruction
					) {
						throw new Error(
							"Gemma models do not support system instructions"
						);
					}
					return Promise.resolve({
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Mock response",
										},
									],
								},
							},
						],
					});
				}
			);
		});

		it("should throw error for Gemma models when systemPromptSupport is true", async () => {
			await expect(
				gemmaLLM.autocomplete(
					"You are a helpful assistant",
					"Write a hello world function",
					undefined,
					0.7,
					1000,
					undefined,
					false,
					true
				)
			).rejects.toThrow(
				"Gemini SDK error: Gemma models do not support system instructions"
			);
		});

		it("should throw error for Gemma models with userPrompt when systemPromptSupport is true", async () => {
			await expect(
				gemmaLLM.autocomplete(
					"You are a helpful assistant",
					"Write a hello world function",
					undefined,
					0.7,
					1000,
					"Custom user prompt",
					false,
					true
				)
			).rejects.toThrow(
				"Gemini SDK error: Gemma models do not support system instructions"
			);
		});
	});
});
