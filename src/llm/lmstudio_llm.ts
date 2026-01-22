import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function getFirstDeltaContent(data: unknown): string | undefined {
	if (!isRecord(data)) return;
	const choices = (data as { choices?: unknown }).choices;
	if (!isUnknownArray(choices) || choices.length === 0) return;
	const firstChoice = choices[0];
	if (!isRecord(firstChoice)) return;
	const delta = (firstChoice as { delta?: unknown }).delta;
	if (!isRecord(delta)) return;
	const content = (delta as { content?: unknown }).content;
	if (typeof content !== "string") return;
	return content;
}

function getFirstMessageContent(data: unknown): string | undefined {
	if (!isRecord(data)) return;
	const choices = (data as { choices?: unknown }).choices;
	if (!isUnknownArray(choices) || choices.length === 0) return;
	const firstChoice = choices[0];
	if (!isRecord(firstChoice)) return;
	const message = (firstChoice as { message?: unknown }).message;
	if (!isRecord(message)) return;
	const content = (message as { content?: unknown }).content;
	if (typeof content !== "string") return;
	return content;
}

export class LMStudioLLM extends BaseProviderLLM {
	constructor(
		provider: AIProvider,
		modelName: string,
		useNativeFetch: boolean = false
	) {
		super(provider, modelName, useNativeFetch);
	}

	protected getDefaultBaseUrl(): string {
		return "http://localhost:1234/v1";
	}

	protected getHeaders(): Record<string, string> {
		// LMStudio typically doesn't require authorization for local instances
		// but we'll include the API key if provided
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.provider.apiKey) {
			headers["Authorization"] = `Bearer ${this.provider.apiKey}`;
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
		systemPromptSupport?: boolean
	): Promise<string | void> {
		// Determine the role for the prompt based on systemPromptSupport
		const promptRole = systemPromptSupport !== false ? "system" : "user";

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
				`LMStudio API error: ${response.status} ${response.statusText}`
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
								const data: unknown = JSON.parse(jsonStr);
								const deltaContent = getFirstDeltaContent(data);
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
			const data: unknown = await response.json();

			let result = "";
			const messageContent = getFirstMessageContent(data);
			result = messageContent ?? "";

			// Call callback with the full result if provided
			if (callback && result) {
				callback(result);
			}

			return result;
		}
	}
}
