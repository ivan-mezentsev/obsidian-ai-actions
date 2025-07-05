import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";
import { GoogleGenAI } from "@google/genai";

export class GeminiLLM extends BaseProviderLLM {
	private client: GoogleGenAI;

	constructor(
		provider: AIProvider,
		modelName: string,
		useNativeFetch: boolean = false
	) {
		super(provider, modelName, useNativeFetch);

		this.client = new GoogleGenAI({
			apiKey: provider.apiKey,
			apiVersion: "v1beta",
		});
	}

	protected getDefaultBaseUrl(): string {
		// Not used with SDK, but kept for compatibility
		return "https://generativelanguage.googleapis.com/v1beta";
	}

	async autocomplete(
		prompt: string,
		content: string,
		temperature?: number,
		maxOutputTokens?: number,
	): Promise<string> {
		try {
			const contents = [
				{ role: "user", parts: [{ text: prompt }] },
				{ role: "user", parts: [{ text: content }] },
			];

			const config: any = {
				temperature: temperature !== undefined ? temperature : 0.7,
				maxOutputTokens:
					maxOutputTokens && maxOutputTokens > 0
						? maxOutputTokens
						: 1000,
			};

			const response = await this.client.models.generateContent({
				model: this.modelName,
				contents,
				config,
			});

			// Gemini SDK returns candidates[0].content.parts[0].text
			if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
				return response.candidates[0].content.parts[0].text;
			}
			return "";
		} catch (error) {
			throw new Error(
				`Gemini SDK error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	async autocompleteStreamingInner(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
	): Promise<void> {
		try {
			const contents = [
				{ role: "user", parts: [{ text: prompt }] },
				{ role: "user", parts: [{ text: content }] },
			];

			const config: any = {
				temperature: temperature !== undefined ? temperature : 0.7,
				maxOutputTokens:
					maxOutputTokens && maxOutputTokens > 0
						? maxOutputTokens
						: 1000,
			};

			const stream = await this.client.models.generateContentStream({
				model: this.modelName,
				contents,
				config,
			});

			for await (const chunk of stream) {
				if (chunk?.candidates?.[0]?.content?.parts?.[0]?.text) {
					callback(chunk.candidates[0].content.parts[0].text);
				}
			}
		} catch (error) {
			throw new Error(
				`Gemini streaming SDK error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	async autocompleteStreamingInnerWithUserPrompt(
		systemPrompt: string,
		content: string,
		userPrompt: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
	): Promise<void> {
		try {
			const contents = [
				{ role: "user", parts: [{ text: systemPrompt }] },
				{ role: "user", parts: [{ text: userPrompt }] },
				{ role: "user", parts: [{ text: content }] },
			];

			const config: any = {
				temperature: temperature !== undefined ? temperature : 0.7,
				maxOutputTokens:
					maxOutputTokens && maxOutputTokens > 0
						? maxOutputTokens
						: 1000,
			};

			const stream = await this.client.models.generateContentStream({
				model: this.modelName,
				contents,
				config,
			});

			for await (const chunk of stream) {
				if (chunk?.candidates?.[0]?.content?.parts?.[0]?.text) {
					callback(chunk.candidates[0].content.parts[0].text);
				}
			}
		} catch (error) {
			throw new Error(
				`Gemini streaming SDK error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
