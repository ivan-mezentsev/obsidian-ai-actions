// Mock for Google Gemini SDK
export class GoogleGenAI {
	private apiKey: string;
	private apiVersion: string;

	constructor(config: { apiKey: string; apiVersion?: string }) {
		this.apiKey = config.apiKey;
		this.apiVersion = config.apiVersion || "v1beta";
	}

	models = {
		generateContent: jest
			.fn()
			.mockImplementation(
				(request: {
					model?: string;
					config?: { systemInstruction?: string };
				}) => {
					// Check if this is a Gemma model trying to use systemInstruction
					if (
						request.model &&
						request.model.toLowerCase().includes("gemma") &&
						request.config?.systemInstruction
					) {
						throw new Error(
							"Gemma models do not support system instructions"
						);
					}
					// Default behavior for other cases
					return Promise.resolve({
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Mock response",
										},
									],
								},
							},
						],
					});
				}
			),
		generateContentStream: jest.fn(),
	};
}

// Helper function to create mock streaming response
export const createMockStreamingResponse = (chunks: string[]) => {
	return {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) {
				yield {
					candidates: [
						{
							content: {
								parts: [
									{
										text: chunk,
									},
								],
							},
						},
					],
				};
			}
		},
	};
};

// Helper function to create mock regular response
export const createMockResponse = (text: string) => {
	return {
		candidates: [
			{
				content: {
					parts: [
						{
							text: text,
						},
					],
				},
			},
		],
	};
};

// Helper function to create mock error
export const createMockError = (message: string) => {
	const error = new Error(message);
	return error;
};
