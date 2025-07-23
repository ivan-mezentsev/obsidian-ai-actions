import { LLM } from "./base";

const textForTesting =
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

export class DummyLLM extends LLM {
	async autocomplete(
		prompt: string,
		content: string,
		callback?: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string,
		streaming: boolean = false
	): Promise<string | void> {
		if (streaming && callback) {
			// Streaming mode
			return new Promise(resolve => {
				const responseText = userPrompt
					? `Response to system: "${prompt}" and user prompt: "${userPrompt}" with content: "${content}" - ${textForTesting}`
					: textForTesting;
				const split = responseText.split(" ");

				const processNextChunk = async (index: number) => {
					if (index >= split.length) {
						resolve();
						return;
					}

					callback(split[index] + " ");
					await new Promise(r => setTimeout(r, 20));
					await processNextChunk(index + 1);
				};

				processNextChunk(0);
			});
		} else {
			// Non-streaming mode
			return new Promise(resolve => {
				resolve(textForTesting);
			});
		}
	}
}
