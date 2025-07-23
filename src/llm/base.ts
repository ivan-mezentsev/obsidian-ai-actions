export abstract class LLM {
	// For streaming mode, this is the timeout between each callback
	// For non-streaming mode, this is the timeout for the whole query
	queryTimeout = 45000;

	abstract autocomplete(
		prompt: string,
		content: string,
		callback?: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string,
		streaming?: boolean
	): Promise<string | void>;

	async autocompleteStreaming(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number,
		userPrompt?: string
	): Promise<void> {
		let last_tick = new Date().getTime();
		let has_timeout = false;

		// define a wrapper function to update last_tick
		function callback_wrapper(text: string): void {
			// Once start the query promise, we cannot cancel it.
			// Ignore the callback if timeout has already happened.
			if (has_timeout) {
				return;
			}
			last_tick = new Date().getTime();
			callback(text);
		}

		let promise = this.autocomplete(prompt, content, callback_wrapper, temperature, maxOutputTokens, userPrompt, true);
		return new Promise<void>((resolve, reject) => {
			const intervalId = globalThis.setInterval(() => {
				let now = new Date().getTime();
				if (now - last_tick > this.queryTimeout) {
					has_timeout = true;
					clearInterval(intervalId);
					reject(
						"Timeout: last streaming output is " +
							(now - last_tick) +
							"ms ago."
					);
				}
			}, 1000);
			promise
				.then((_: string | void) => {
					clearInterval(intervalId);
					resolve();
				})
				.catch((error: Error) => {
					clearInterval(intervalId);
					reject(error);
				});
		});
	}
}
