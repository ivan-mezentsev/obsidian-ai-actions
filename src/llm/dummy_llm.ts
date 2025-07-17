import { LLM } from "./base";

const textForTesting =
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

export class DummyLLM extends LLM {
	async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
		return new Promise((resolve) => {
			resolve(textForTesting);
		});
	}

	async autocompleteStreamingInner(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string
	): Promise<void> {
		return new Promise(async (resolve) => {
			const responseText = userPrompt 
				? `Response to system: "${prompt}" and user prompt: "${userPrompt}" with content: "${content}" - ${textForTesting}`
				: textForTesting;
			const split = responseText.split(" ");
			for (const element of split) {
				callback(element + " ");
				await new Promise((r) => setTimeout(r, 20));
			}
			resolve();
		});
	}
}
