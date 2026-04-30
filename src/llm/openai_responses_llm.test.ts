import { OpenAIModel } from "./openai_llm";
import { OpenAIResponsesLLM } from "./openai_responses_llm";
import { LLMFactory } from "./factory";
import type { AIEditorSettings } from "../settings";
import { Location, Selection } from "../action";

type MockOpenAIClient = {
	responses: {
		create: jest.Mock;
	};
};

jest.mock("openai", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => ({
		responses: {
			create: jest.fn(),
		},
	})),
}));

describe("OpenAIResponsesLLM", () => {
	let openaiResponsesLLM: OpenAIResponsesLLM;
	let mockClient: MockOpenAIClient;

	beforeEach(() => {
		jest.clearAllMocks();

		openaiResponsesLLM = new OpenAIResponsesLLM(
			OpenAIModel.GPT_4O_MINI,
			"test-api-key",
			"https://api.openai.com/v1"
		);

		mockClient = openaiResponsesLLM[
			"openai"
		] as unknown as MockOpenAIClient;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with correct parameters", () => {
			expect(openaiResponsesLLM).toBeDefined();
			expect(openaiResponsesLLM["model"]).toBe(OpenAIModel.GPT_4O_MINI);
		});

		it("should initialize without baseURL", () => {
			const openaiWithoutBase = new OpenAIResponsesLLM(
				OpenAIModel.GPT_4O_MINI,
				"test-api-key"
			);
			expect(openaiWithoutBase).toBeDefined();
		});

		it("should handle empty baseURL", () => {
			const openaiWithEmptyBase = new OpenAIResponsesLLM(
				OpenAIModel.GPT_4O_MINI,
				"test-api-key",
				""
			);
			expect(openaiWithEmptyBase).toBeDefined();
		});
	});

	describe("autocomplete", () => {
		it("should successfully generate response", async () => {
			mockClient.responses.create.mockResolvedValue({
				output_text: "Generated response text",
			});

			const result = await openaiResponsesLLM.autocomplete(
				"You are a helpful assistant",
				"Write a hello world function",
				undefined,
				0.7
			);

			expect(result).toBe("Generated response text");
			expect(mockClient.responses.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				input: [
					{
						role: "user",
						content: "Write a hello world function",
					},
				],
				temperature: 0.7,
				instructions: "You are a helpful assistant",
			});
		});

		it("should use default temperature when not provided", async () => {
			mockClient.responses.create.mockResolvedValue({
				output_text: "Default response",
			});

			await openaiResponsesLLM.autocomplete(
				"System prompt",
				"User input"
			);

			expect(mockClient.responses.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				input: [{ role: "user", content: "User input" }],
				temperature: 0.7,
				instructions: "System prompt",
			});
		});

		it("should handle output array fallback", async () => {
			mockClient.responses.create.mockResolvedValue({
				output: [
					{
						content: [
							{ type: "output_text", text: "Part 1" },
							{ type: "output_text", text: " and part 2" },
						],
					},
				],
			});

			const result = await openaiResponsesLLM.autocomplete(
				"prompt",
				"content"
			);

			expect(result).toBe("Part 1 and part 2");
		});

		it("should not call callback in non-streaming mode when result is empty", async () => {
			mockClient.responses.create.mockResolvedValue({ output: [] });

			const callback = jest.fn();
			const result = await openaiResponsesLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				false
			);

			expect(result).toBe("");
			expect(callback).not.toHaveBeenCalled();
		});

		it("should handle userPrompt correctly", async () => {
			mockClient.responses.create.mockResolvedValue({
				output_text: "Response with user prompt",
			});

			await openaiResponsesLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				"User custom prompt"
			);

			expect(mockClient.responses.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				input: [
					{ role: "user", content: "User custom prompt" },
					{ role: "user", content: "Content text" },
				],
				temperature: 0.7,
				instructions: "System instruction",
			});
		});

		it("should move prompt to input when systemPromptSupport is false", async () => {
			mockClient.responses.create.mockResolvedValue({
				output_text: "User prompt response",
			});

			await openaiResponsesLLM.autocomplete(
				"System instruction",
				"Content text",
				undefined,
				0.7,
				"User custom prompt",
				false,
				false
			);

			expect(mockClient.responses.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				input: [
					{ role: "user", content: "System instruction" },
					{ role: "user", content: "User custom prompt" },
					{ role: "user", content: "Content text" },
				],
				temperature: 0.7,
			});
		});

		it("should stream response text deltas", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "response.output_text.delta",
						delta: "Hello",
					};
					yield {
						type: "response.output_text.delta",
						delta: " world",
					};
					yield {
						type: "response.completed",
					};
				},
			};
			mockClient.responses.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await openaiResponsesLLM.autocomplete(
				"You are helpful",
				"Say hello",
				callback,
				0.8,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, "Hello");
			expect(callback).toHaveBeenNthCalledWith(2, " world");

			expect(mockClient.responses.create).toHaveBeenCalledWith({
				model: OpenAIModel.GPT_4O_MINI,
				input: [{ role: "user", content: "Say hello" }],
				temperature: 0.8,
				instructions: "You are helpful",
				stream: true,
			});
		});

		it("should stream reasoning deltas when the provider includes them", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					await Promise.resolve();
					yield {
						type: "response.reasoning_text.delta",
						delta: "Step 1",
					};
					yield {
						type: "response.reasoning_summary_text.delta",
						delta: " then step 2",
					};
					yield {
						type: "response.output_text.delta",
						delta: "Final answer",
					};
				},
			};
			mockClient.responses.create.mockResolvedValue(mockStream);

			const callback = jest.fn();
			await openaiResponsesLLM.autocomplete(
				"prompt",
				"content",
				callback,
				undefined,
				undefined,
				true
			);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "<think>Step 1");
			expect(callback).toHaveBeenNthCalledWith(2, " then step 2");
			expect(callback).toHaveBeenNthCalledWith(3, "</think>Final answer");
		});

		it("should propagate API errors", async () => {
			const apiError = new Error("API rate limit exceeded");
			mockClient.responses.create.mockRejectedValue(apiError);

			await expect(
				openaiResponsesLLM.autocomplete("prompt", "content")
			).rejects.toThrow("API rate limit exceeded");
		});
	});
});

describe("LLMFactory with OpenAI Responses", () => {
	it("should create OpenAIResponsesLLM for openai provider when model mode is responses", () => {
		const settings: AIEditorSettings = {
			customActions: [],
			quickPrompt: {
				name: "Quick Prompt",
				prompt: "Prompt",
				sel: Selection.CURSOR,
				loc: Location.REPLACE_CURRENT,
				format: "{{result}}",
				model: "model1",
				temperature: undefined,
			},
			aiProviders: {
				providers: [
					{
						id: "provider1",
						name: "OpenAI",
						type: "openai",
						apiKey: "test-api-key",
						url: "https://api.openai.com/v1",
					},
				],
				models: [
					{
						id: "model1",
						name: "GPT 4o mini",
						providerId: "provider1",
						modelName: OpenAIModel.GPT_4O_MINI,
						openAIRequestMode: "responses",
						temperatureSupported: true,
					},
				],
				usePluginAIProviders: false,
			},
			useNativeFetch: false,
			developmentMode: false,
		};

		const factory = new LLMFactory(settings);
		const llm = factory.create("model1");

		expect(llm).toBeInstanceOf(OpenAIResponsesLLM);
	});
});
