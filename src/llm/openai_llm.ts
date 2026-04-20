import OpenAI from "openai";
import { LLM } from "./base";

type AsyncIterableLike<T> = {
	[Symbol.asyncIterator](): {
		next(): Promise<{ value: T; done: boolean }>;
	};
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function extractReasoningDetails(value: unknown): string[] {
	if (!isUnknownArray(value)) {
		return [];
	}

	return value.flatMap(item => {
		if (!isRecord(item)) {
			return [];
		}

		const text = item["text"];
		if (typeof text === "string") {
			return [text];
		}

		const content = item["content"];
		if (typeof content === "string") {
			return [content];
		}

		return [];
	});
}

function getStreamingDeltaParts(chunk: unknown): {
	content: string;
	reasoning: string;
} {
	if (!isRecord(chunk)) {
		return { content: "", reasoning: "" };
	}

	const choices = chunk["choices"];
	if (!isUnknownArray(choices) || choices.length === 0) {
		return { content: "", reasoning: "" };
	}

	const firstChoice = choices[0];
	if (!isRecord(firstChoice)) {
		return { content: "", reasoning: "" };
	}

	const delta = firstChoice["delta"];
	if (!isRecord(delta)) {
		return { content: "", reasoning: "" };
	}

	return {
		content: typeof delta["content"] === "string" ? delta["content"] : "",
		reasoning: [
			typeof delta["reasoning"] === "string" ? delta["reasoning"] : "",
			typeof delta["reasoning_content"] === "string"
				? delta["reasoning_content"]
				: "",
			...extractReasoningDetails(delta["reasoning_details"]),
		].join(""),
	};
}

export enum OpenAIModel {
	GPT_4O_MINI = "gpt-4o-mini",
}

export class OpenAILLM extends LLM {
	private openai: OpenAI;
	private model: OpenAIModel;

	constructor(model: OpenAIModel, apiKey: string, baseURL?: string) {
		super();
		this.model = model;
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
		maxOutputTokens?: number,
		userPrompt?: string,
		streaming: boolean = false,
		systemPromptSupport: boolean = true
	): Promise<string | void> {
		try {
			const messages = systemPromptSupport
				? userPrompt
					? [
							{ role: "system" as const, content: prompt },
							{ role: "user" as const, content: userPrompt },
							{ role: "user" as const, content: content },
						]
					: [
							{ role: "system" as const, content: prompt },
							{ role: "user" as const, content: content },
						]
				: userPrompt
					? [
							{ role: "user" as const, content: prompt },
							{ role: "user" as const, content: userPrompt },
							{ role: "user" as const, content: content },
						]
					: [
							{ role: "user" as const, content: prompt },
							{ role: "user" as const, content: content },
						];

			const baseRequestData = {
				model: this.model,
				messages: messages,
				max_tokens:
					maxOutputTokens && maxOutputTokens > 0
						? maxOutputTokens
						: 4000,
				temperature: temperature !== undefined ? temperature : 0.7,
			};

			if (streaming && callback) {
				// Streaming mode
				const requestData = { ...baseRequestData, stream: true };
				const stream = await this.openai.chat.completions.create(
					requestData as Parameters<
						typeof this.openai.chat.completions.create
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
					for await (const chunk of stream as unknown as AsyncIterableLike<OpenAI.Chat.Completions.ChatCompletionChunk>) {
						const delta = getStreamingDeltaParts(chunk);
						emitReasoning(delta.reasoning);
						emitContent(delta.content);
					}

					if (isThinking) {
						callback("</think>");
					}
				}
				return;
			} else {
				// Non-streaming mode
				const response = await this.openai.chat.completions.create(
					baseRequestData as Parameters<
						typeof this.openai.chat.completions.create
					>[0]
				);
				const result =
					(response as OpenAI.Chat.Completions.ChatCompletion)
						.choices[0]?.message?.content || "";

				// Call callback with the full result if provided
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
