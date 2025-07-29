import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";
import Anthropic from "@anthropic-ai/sdk";

export class AnthropicLLM extends BaseProviderLLM {
	private client: Anthropic;

	constructor(
		provider: AIProvider,
		modelName: string,
		useNativeFetch: boolean = false
	) {
		super(provider, modelName, useNativeFetch);

		this.client = new Anthropic({
			apiKey: provider.apiKey,
			baseURL: provider.url || this.getDefaultBaseUrl(),
			dangerouslyAllowBrowser: true,
		});
	}

	protected getDefaultBaseUrl(): string {
		return "https://api.anthropic.com";
	}

	protected getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
		};

		if (this.provider.apiKey) {
			headers["x-api-key"] = this.provider.apiKey;
		}

		return headers;
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
			let messages: Array<{ role: "user"; content: string }>;
			let systemPrompt: string | undefined;

			if (systemPromptSupport) {
				// Use system parameter in API
				systemPrompt = prompt;
				messages = userPrompt
					? [
							{
								role: "user" as const,
								content: userPrompt,
							},
							{
								role: "user" as const,
								content: content,
							},
						]
					: [
							{
								role: "user" as const,
								content: content,
							},
						];
			} else {
				// Add prompt as first user message
				systemPrompt = undefined;
				messages = userPrompt
					? [
							{
								role: "user" as const,
								content: prompt,
							},
							{
								role: "user" as const,
								content: userPrompt,
							},
							{
								role: "user" as const,
								content: content,
							},
						]
					: [
							{
								role: "user" as const,
								content: prompt,
							},
							{
								role: "user" as const,
								content: content,
							},
						];
			}

			if (streaming && callback) {
				// Streaming mode
				const requestParams: Anthropic.MessageCreateParams = {
					model: this.modelName,
					max_tokens:
						maxOutputTokens && maxOutputTokens > 0
							? maxOutputTokens
							: 1000,
					temperature: temperature !== undefined ? temperature : 0.7,
					messages: messages,
					stream: true,
				};

				if (systemPrompt) {
					requestParams.system = systemPrompt;
				}

				const stream = await this.client.messages.create(requestParams);

				for await (const chunk of stream) {
					if (
						chunk.type === "content_block_delta" &&
						chunk.delta.type === "text_delta"
					) {
						callback(chunk.delta.text);
					}
				}
				return;
			} else {
				// Non-streaming mode
				const requestParams: Anthropic.MessageCreateParams = {
					model: this.modelName,
					max_tokens:
						maxOutputTokens && maxOutputTokens > 0
							? maxOutputTokens
							: 1000,
					temperature: temperature !== undefined ? temperature : 0.7,
					messages: messages,
				};

				if (systemPrompt) {
					requestParams.system = systemPrompt;
				}

				const message =
					await this.client.messages.create(requestParams);

				let result = "";
				if (message.content && message.content.length > 0) {
					const textBlock = message.content.find(
						(block: { type: string; text?: string }) =>
							block.type === "text"
					);
					if (textBlock && "text" in textBlock) {
						result = textBlock.text;
					}
				}

				// Call callback with the full result if provided
				if (callback && result) {
					callback(result);
				}

				return result;
			}
		} catch (error) {
			throw new Error(
				`Anthropic API error: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}
}
