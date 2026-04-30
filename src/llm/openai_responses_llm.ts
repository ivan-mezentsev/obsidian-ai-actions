import OpenAI from "openai";
import { LLM } from "./base";
import { OpenAIModel } from "./openai_llm";

type AsyncIterableLike<T> = {
	[Symbol.asyncIterator](): {
		next(): Promise<{ value: T; done: boolean }>;
	};
};

type ResponsesInputMessage = {
	role: "user";
	content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function getResponseOutputText(response: unknown): string {
	if (!isRecord(response)) {
		return "";
	}

	const outputText = response["output_text"];
	if (typeof outputText === "string") {
		return outputText;
	}

	const output = response["output"];
	if (!isUnknownArray(output)) {
		return "";
	}

	return output
		.flatMap(item => {
			if (!isRecord(item) || !isUnknownArray(item["content"])) {
				return [];
			}

			return item["content"].flatMap(contentPart => {
				if (!isRecord(contentPart)) {
					return [];
				}

				const text = contentPart["text"];
				return typeof text === "string" ? [text] : [];
			});
		})
		.join("");
}

function getResponsesStreamingDeltaParts(event: unknown): {
	content: string;
	reasoning: string;
} {
	if (!isRecord(event)) {
		return { content: "", reasoning: "" };
	}

	const type = event["type"];
	const delta = event["delta"];
	if (typeof type !== "string" || typeof delta !== "string") {
		return { content: "", reasoning: "" };
	}

	if (type.includes("reasoning") || type.includes("summary_text")) {
		return { content: "", reasoning: delta };
	}

	if (
		type === "response.output_text.delta" ||
		type === "response.text.delta"
	) {
		return { content: delta, reasoning: "" };
	}

	return { content: "", reasoning: "" };
}

function buildResponsesInput(
	prompt: string,
	content: string,
	userPrompt: string | undefined,
	systemPromptSupport: boolean
): ResponsesInputMessage[] {
	const input: ResponsesInputMessage[] = [];

	if (!systemPromptSupport) {
		input.push({ role: "user", content: prompt });
	}

	if (userPrompt) {
		input.push({ role: "user", content: userPrompt });
	}

	input.push({ role: "user", content: content });

	return input;
}

export class OpenAIResponsesLLM extends LLM {
	private openai: OpenAI;
	private model: OpenAIModel;
	private reasoningSummarySupported: boolean;

	constructor(
		model: OpenAIModel,
		apiKey: string,
		baseURL?: string,
		temperatureSupported: boolean = true,
		reasoningSummarySupported: boolean = true
	) {
		super(temperatureSupported);
		this.model = model;
		this.reasoningSummarySupported = reasoningSummarySupported;
		const config: {
			apiKey: string;
			dangerouslyAllowBrowser: boolean;
			baseURL?: string;
		} = {
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		};
		if (baseURL && baseURL.trim() !== "") {
			config.baseURL = baseURL;
		}
		this.openai = new OpenAI(config);
	}

	async autocomplete(
		prompt: string,
		content: string,
		callback?: (text: string) => void,
		temperature?: number,
		userPrompt?: string,
		streaming: boolean = false,
		systemPromptSupport: boolean = true
	): Promise<string | void> {
		try {
			const reasoningConfig = this.reasoningSummarySupported
				? {
						reasoning: {
							summary: "auto" as const,
						},
					}
				: {};

			const baseRequestData = {
				model: this.model,
				input: buildResponsesInput(
					prompt,
					content,
					userPrompt,
					systemPromptSupport
				),
				...this.getTemperatureParam(temperature),
				...reasoningConfig,
				...(systemPromptSupport ? { instructions: prompt } : {}),
			};

			if (streaming && callback) {
				const requestData = { ...baseRequestData, stream: true };
				const stream = await this.openai.responses.create(
					requestData as Parameters<
						typeof this.openai.responses.create
					>[0]
				);
				let isThinking = false;

				const emitReasoning = (text: string) => {
					if (!text) {
						return;
					}

					if (!isThinking) {
						callback(`<think>${text}`);
						isThinking = true;
						return;
					}

					callback(text);
				};

				const emitContent = (text: string) => {
					if (!text) {
						return;
					}

					if (isThinking) {
						callback(`</think>${text}`);
						isThinking = false;
						return;
					}

					callback(text);
				};

				if ("stream" in requestData && requestData.stream) {
					for await (const event of stream as unknown as AsyncIterableLike<unknown>) {
						const delta = getResponsesStreamingDeltaParts(event);
						emitReasoning(delta.reasoning);
						emitContent(delta.content);
					}

					if (isThinking) {
						callback("</think>");
					}
				}
				return;
			} else {
				const response = await this.openai.responses.create(
					baseRequestData as Parameters<
						typeof this.openai.responses.create
					>[0]
				);
				const result = getResponseOutputText(response);

				if (callback && result) {
					callback(result);
				}

				return result;
			}
		} catch (error) {
			console.error("Error in autocomplete:", error);
			throw error;
		}
	}
}
