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
		callback?: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string,
		streaming: boolean = false,
	): Promise<string | void> {
		try {
			// Check if model supports system instructions (avoid for Gemma models)
			const supportsSystemInstruction = !this.modelName.toLowerCase().includes('gemma');
			
			const contents = userPrompt 
				? (supportsSystemInstruction
					? [
						{ role: "user", parts: [{ text: userPrompt }] },
						{ role: "user", parts: [{ text: content }] },
					]
					: [
						{ role: "user", parts: [{ text: prompt }] },
						{ role: "user", parts: [{ text: userPrompt }] },
						{ role: "user", parts: [{ text: content }] },
					])
				: [
					{ role: "user", parts: [{ text: prompt }] },
					{ role: "user", parts: [{ text: content }] },
				];

			const config: {
				temperature: number;
				maxOutputTokens: number;
				systemInstruction?: string;
			} = {
				temperature: temperature !== undefined ? temperature : 0.7,
				maxOutputTokens:
					maxOutputTokens && maxOutputTokens > 0
						? maxOutputTokens
						: 1000,
			};

			// Add system instruction for supported models when userPrompt is provided
			if (userPrompt && supportsSystemInstruction) {
				config.systemInstruction = prompt;
			}

			if (streaming && callback) {
				// Streaming mode
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
				return;
			} else {
				// Non-streaming mode
				const response = await this.client.models.generateContent({
					model: this.modelName,
					contents,
					config,
				});
	
				// Gemini SDK returns candidates[0].content.parts[0].text
				const result = response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
				
				// Call callback with the full result if provided
				if (callback && result) {
					callback(result);
				}
				
				return result;
			}
		} catch (error) {
			throw new Error(
				`Gemini SDK error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
