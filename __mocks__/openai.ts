// Types for OpenAI mocking
export interface ChatCompletion {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string | null;
		};
		finish_reason: string | null;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface ChatCompletionChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			content?: string;
		};
		finish_reason: string | null;
	}>;
}

// Mock implementation for OpenAI
export default class OpenAI {
	chat: {
		completions: {
			create: jest.Mock;
		};
	};

	constructor(_config: {
		apiKey: string;
		dangerouslyAllowBrowser: boolean;
		baseURL?: string;
	}) {
		this.chat = {
			completions: {
				create: jest.fn(),
			},
		};
	}

	// Re-export types under OpenAI namespace for compatibility
	static Chat = {
		Completions: {
			ChatCompletion: {} as ChatCompletion,
			ChatCompletionChunk: {} as ChatCompletionChunk,
		},
	};
}
