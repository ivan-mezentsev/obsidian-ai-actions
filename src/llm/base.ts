export abstract class LLM {
	// For streaming mode, this is the timeout between each callback
	// For non-streaming mode, this is the timeout for the whole query
	queryTimeout = 45000;

	abstract autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string>;

	abstract autocompleteStreamingInner(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
	): Promise<void>;

	abstract autocompleteStreamingInnerWithUserPrompt(
		systemPrompt: string,
		content: string,
		userPrompt: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
	): Promise<void>;

	async autocompleteStreaming(
		prompt: string,
		content: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
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

		let promise = this.autocompleteStreamingInner(prompt, content, callback_wrapper, temperature, maxOutputTokens);
		return new Promise<void>((resolve, reject) => {
			const intervalId = setInterval(() => {
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
				.then((_) => {
					clearInterval(intervalId);
					resolve();
				})
				.catch((error) => {
					clearInterval(intervalId);
					reject(error);
				});
		});
	}

	async autocompleteStreamingWithUserPrompt(
		systemPrompt: string,
		content: string,
		userPrompt: string,
		callback: (text: string) => void,
		temperature?: number,
		maxOutputTokens?: number
	): Promise<void> {
		var last_tick = new Date().getTime();
		var has_timeout = false;

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

		let promise = this.autocompleteStreamingInnerWithUserPrompt(systemPrompt, content, userPrompt, callback_wrapper, temperature, maxOutputTokens);
		return new Promise<void>((resolve, reject) => {
			const intervalId = setInterval(() => {
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
				.then((_) => {
					clearInterval(intervalId);
					resolve();
				})
				.catch((error) => {
					clearInterval(intervalId);
					reject(error);
				});
		});
	}
}
