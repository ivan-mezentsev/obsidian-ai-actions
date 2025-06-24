import OpenAI from "openai";
import { LLM } from "./base";

export enum OpenAIModel {
	GPT_3_5_16k = "gpt-3.5-turbo-16k",
	GPT_3_5_INSTRUCT = "gpt-3.5-turbo-instruct",
	GPT_3_5_TURBO_PREVIEW = "gpt-3.5-turbo-1106",
	GPT_3_5_TURBO = "gpt-3.5-turbo",
	GPT_4 = "gpt-4",
	GPT_4_32K = "gpt-4-32k",
	GPT_4_TURBO_PREVIEW = "gpt-4-1106-preview",
	GPT_4_TURBO = "gpt-4-turbo",
	GPT_4O = "gpt-4o",
	GPT_4O_AUDIO_PREVIEW = "gpt-4o-audio-preview",
	GPT_4O_AUDIO_PREVIEW_2024_10_01 = "gpt-4o-audio-preview-2024-10-01",
	GPT_4O_MINI = "gpt-4o-mini",
	GPT_4O_MINI_2024_07_18 = "gpt-4o-mini-2024-07-18",
	O1_MINI = "o1-mini",
	O1_MINI_2024_09_12 = "o1-mini-2024-09-12",
	O1_PREVIEW = "o1-preview",
	O1_PREVIEW_2024_09_12 = "o1-preview-2024-09-12",
	CHATGPT_4O_LATEST = "chatgpt-4o-latest",
	GPT_4O_2024_05_13 = "gpt-4o-2024-05-13",
	GPT_4O_2024_08_06 = "gpt-4o-2024-08-06",
	GPT_4O_2024_11_20 = "gpt-4o-2024-11-20",
	GPT_4_TURBO_PREVIEW_2024 = "gpt-4-turbo-preview",
	GPT_4_0314 = "gpt-4-0314",
	GPT_4_0613 = "gpt-4-0613",
	GPT_4_32K_0314 = "gpt-4-32k-0314",
	GPT_4_32K_0613 = "gpt-4-32k-0613",
	GPT_4_TURBO_2024_04_09 = "gpt-4-turbo-2024-04-09",
	GPT_4_1106_PREVIEW = "gpt-4-1106-preview",
	GPT_4_0125_PREVIEW = "gpt-4-0125-preview",
	GPT_4_VISION_PREVIEW = "gpt-4-vision-preview",
	GPT_4_1106_VISION_PREVIEW = "gpt-4-1106-vision-preview",
	GPT_3_5_TURBO_0301 = "gpt-3.5-turbo-0301",
	GPT_3_5_TURBO_0613 = "gpt-3.5-turbo-0613",
	GPT_3_5_TURBO_1106 = "gpt-3.5-turbo-1106",
	GPT_3_5_TURBO_0125 = "gpt-3.5-turbo-0125",
	GPT_3_5_TURBO_16K_0613 = "gpt-3.5-turbo-16k-0613",
	FT_GPT_3_5_TURBO = "ft:gpt-3.5-turbo",
	FT_GPT_3_5_TURBO_0125 = "ft:gpt-3.5-turbo-0125",
	FT_GPT_3_5_TURBO_1106 = "ft:gpt-3.5-turbo-1106",
	FT_GPT_3_5_TURBO_0613 = "ft:gpt-3.5-turbo-0613",
	FT_GPT_4_0613 = "ft:gpt-4-0613",
	FT_GPT_4O_2024_08_06 = "ft:gpt-4o-2024-08-06",
	FT_GPT_4O_2024_11_20 = "ft:gpt-4o-2024-11-20",
	FT_GPT_4O_MINI_2024_07_18 = "ft:gpt-4o-mini-2024-07-18",
}

export class OpenAILLM extends LLM {
	private openai: OpenAI;
	private model: OpenAIModel;
	private debugMode: boolean;

	constructor(model: OpenAIModel, apiKey: string, baseURL?: string, debugMode: boolean = false) {
		super();
		this.model = model;
		this.debugMode = debugMode;
		const config: any = {
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		};
		if (baseURL && baseURL.trim() !== "") {
			config.baseURL = baseURL;
		}
		this.openai = new OpenAI(config);
	}

	async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
		try {
			const systemPrompt = prompt;
			const userContent = content;
			
			const requestData: any = {
			model: this.model,
			messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: userContent }
			],
			max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 4000,
			temperature: temperature !== undefined ? temperature : 0.7,
		};
			
			const response = await this.openai.chat.completions.create(requestData);
			
			return response.choices[0]?.message?.content || "";
		} catch (error) {
			throw error;
		}
	}

	async autocompleteStreamingInner(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
	): Promise<void> {
		try {
			
			const requestData: any = {
				model: this.model,
				messages: [
					{ role: "system" as const, content: prompt },
				{ role: "user" as const, content: content }
				],
				max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 4000,
				temperature: temperature !== undefined ? temperature : 0.7,
				stream: true as const,
			};
			
			const stream: any = await this.openai.chat.completions.create(requestData);

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content;
				if (content) {
					callback(content);
				}
			}
		} catch (error) {
			throw error;
		}
	}

	async autocompleteStreamingInnerWithUserPrompt(
		systemPrompt: string,
		content: string,
		userPrompt: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
	): Promise<void> {
		try {
			
			const requestData: any = {
				model: this.model,
				messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: userPrompt },
				{ role: "user" as const, content: content }
			],
				max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 4000,
				temperature: temperature !== undefined ? temperature : 0.7,
				stream: true as const,
			};
			
			if (this.debugMode) {
				console.log(`[AI Actions Debug] OpenAI Streaming Request with User Prompt:`, requestData);
			}
			
			const stream: any = await this.openai.chat.completions.create(requestData);

			for await (const chunk of stream) {
				if (this.debugMode) {
					console.log(`[AI Actions Debug] OpenAI Streaming Chunk:`, chunk);
				}
				const content = chunk.choices[0]?.delta?.content;
				if (content) {
					callback(content);
				}
			}
		} catch (error) {
			if (this.debugMode) {
				console.log(`[AI Actions Debug] OpenAI Streaming API error with User Prompt:`, error);
			}
			console.error("Error in autocompleteStreamingInnerWithUserPrompt:", error);
			throw error;
		}
	}
}
