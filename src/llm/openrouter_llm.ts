import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function getOpenRouterDeltaContent(payload: unknown): string | undefined {
	if (!isRecord(payload)) return undefined;

	const choices = payload["choices"];
	if (!isUnknownArray(choices) || choices.length === 0) return undefined;

	const firstChoice = choices[0];
	if (!isRecord(firstChoice)) return undefined;

	const delta = firstChoice["delta"];
	if (!isRecord(delta)) return undefined;

	const content = delta["content"];
	return typeof content === "string" ? content : undefined;
}

function getOpenRouterMessageContent(payload: unknown): string | undefined {
	if (!isRecord(payload)) return undefined;

	const choices = payload["choices"];
	if (!isUnknownArray(choices) || choices.length === 0) return undefined;

	const firstChoice = choices[0];
	if (!isRecord(firstChoice)) return undefined;

	const message = firstChoice["message"];
	if (!isRecord(message)) return undefined;

	const content = message["content"];
	return typeof content === "string" ? content : undefined;
}

export class OpenRouterLLM extends BaseProviderLLM {
	constructor(
		provider: AIProvider,
		modelName: string,
		useNativeFetch: boolean = false
	) {
		super(provider, modelName, useNativeFetch);
	}

	protected getDefaultBaseUrl(): string {
		return "https://openrouter.ai/api/v1";
	}

	protected getHeaders(): Record<string, string> {
		const headers = super.getHeaders();

		// OpenRouter specific headers
		headers["HTTP-Referer"] = "https://obsidian.md";
		headers["X-Title"] = "Obsidian AI Actions";

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

		const body = {
			model: this.modelName,
			messages: messages,
			temperature: temperature !== undefined ? temperature : 0.7,
			max_tokens:
				maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
			stream: streaming,
		};

		const response = await this.makeRequest("/chat/completions", body);

		if (!response.ok) {
			throw new Error(
				`OpenRouter API error: ${response.status} ${response.statusText}`
			);
		}

		if (streaming && callback) {
			// Streaming mode
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body reader available");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (line.trim() && line.startsWith("data: ")) {
							const jsonStr = line.slice(6);
							if (jsonStr.trim() === "[DONE]") break;

							try {
								const data = JSON.parse(jsonStr) as unknown;
								const deltaContent =
									getOpenRouterDeltaContent(data);
								if (deltaContent) {
									callback(deltaContent);
								}
							} catch {
								// Skip invalid JSON lines
							}
						}
					}
				}
			} finally {
				reader.releaseLock();
			}
			return;
		} else {
			// Non-streaming mode
			const data = (await response.json()) as unknown;

			let result = "";
			result = getOpenRouterMessageContent(data) ?? "";

			// Call callback with the full result if provided
			if (callback && result) {
				callback(result);
			}

			return result;
		}
	}
}
