import { LLM } from "./base";
import { waitForAI } from "@obsidian-ai-providers/sdk";

export class PluginAIProvidersLLM extends LLM {
	private pluginAIProviderId: string;

	constructor(pluginAIProviderId: string) {
		super();
		this.pluginAIProviderId = pluginAIProviderId;
	}

	async autocomplete(
		prompt: string,
		content: string,
		callback?: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string,
		streaming: boolean = false,
		_systemPromptSupport?: boolean
	): Promise<string | void> {
		const { promise } = await waitForAI();
		const aiProviders = await promise;

		const provider = aiProviders.providers.find(
			p => p.id === this.pluginAIProviderId
		);
		if (!provider) {
			throw new Error(
				`Provider with id ${this.pluginAIProviderId} not found`
			);
		}

		const messages = userPrompt
			? [
					{ role: "user", content: prompt },
					{ role: "user", content: userPrompt },
					{ role: "user", content: content },
				]
			: [
					{ role: "user", content: prompt },
					{ role: "user", content: content },
				];

		return new Promise((resolve, reject) => {
			let result = "";

			const executeRequest = async () => {
				try {
					const chunkHandler = await aiProviders.execute({
						provider,
						messages: messages,
					});

					chunkHandler.onData((chunk: string) => {
						if (streaming && callback) {
							callback(chunk);
						} else {
							result += chunk;
						}
					});

					chunkHandler.onEnd(() => {
						if (streaming) {
							resolve();
						} else {
							resolve(result);
						}
					});

					chunkHandler.onError((error: Error) => {
						reject(
							new Error(
								`Plugin AI providers API error: ${error.message}`
							)
						);
					});
				} catch (error) {
					reject(
						new Error(
							`Plugin AI providers API error: ${error instanceof Error ? error.message : "Unknown error"}`
						)
					);
				}
			};

			executeRequest();
		});
	}
}
