import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function getFirstDeltaContent(value: unknown): string | null {
	if (!isRecord(value)) return null;

	const choicesValue = value["choices"];
	if (!isUnknownArray(choicesValue) || choicesValue.length === 0) return null;

	const firstChoice = choicesValue[0];
	if (!isRecord(firstChoice)) return null;

	const delta = firstChoice["delta"];
	if (!isRecord(delta)) return null;

	const content = delta["content"];
	return typeof content === "string" ? content : null;
}

function getFirstMessageContent(value: unknown): string | null {
	if (!isRecord(value)) return null;

	const choicesValue = value["choices"];
	if (!isUnknownArray(choicesValue) || choicesValue.length === 0) return null;

	const firstChoice = choicesValue[0];
	if (!isRecord(firstChoice)) return null;

	const message = firstChoice["message"];
	if (!isRecord(message)) return null;

	const content = message["content"];
	return typeof content === "string" ? content : null;
}

export class GroqLLM extends BaseProviderLLM {
	constructor(
		provider: AIProvider,
		modelName: string,
		useNativeFetch: boolean = false
	) {
		super(provider, modelName, useNativeFetch);
	}

	protected getDefaultBaseUrl(): string {
		return "https://api.groq.com/openai/v1";
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
		const promptRole = systemPromptSupport ? "system" : "user";

		const messages = userPrompt
			? [
					{
						role: promptRole,
						content: prompt,
					},
					{
						role: "user",
						content: userPrompt,
					},
					{
						role: "user",
						content: content,
					},
				]
			: [
					{
						role: promptRole,
						content: prompt,
					},
					{
						role: "user",
						content: content,
					},
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
				`Groq API error: ${response.status} ${response.statusText}`
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
								const parsed = JSON.parse(jsonStr) as unknown;
								const deltaContent =
									getFirstDeltaContent(parsed);
								if (deltaContent && deltaContent.length > 0) {
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
			const messageContent = getFirstMessageContent(data);
			const result = messageContent ?? "";

			// Call callback with the full result if provided
			if (callback && result) {
				callback(result);
			}

			return result;
		}
	}
}
