import OpenAI from "openai";
import { LLM } from "./base";

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
		streaming: boolean = false
	): Promise<string | void> {
		try {
			const messages = userPrompt
				? [
						{ role: "system" as const, content: prompt },
						{ role: "user" as const, content: userPrompt },
						{ role: "user" as const, content: content },
					]
				: [
						{ role: "system" as const, content: prompt },
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

				if ("stream" in requestData && requestData.stream) {
					for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
						const content = chunk.choices[0]?.delta?.content;
						if (content) {
							callback(content);
						}
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
