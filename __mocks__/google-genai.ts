// Mock for Google Gemini SDK
const isLegacyGemmaModel = (model?: string) => {
	const normalizedModel = model?.toLowerCase() || "";

	if (!normalizedModel.includes("gemma")) {
		return false;
	}

	if (/^gemma-\d+b(?:-|$)/.test(normalizedModel)) {
		return true;
	}

	const versionMatch = normalizedModel.match(/^gemma-(\d+)-/);
	if (versionMatch) {
		return Number(versionMatch[1]) <= 3;
	}

	return false;
};

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
					// Legacy Gemma models (3 and below) do not support systemInstruction.
					if (
						isLegacyGemmaModel(request.model) &&
						request.config?.systemInstruction
					) {
						throw new Error(
							"Gemma 3 and earlier models do not support system instructions"
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
			// Ensure this async generator contains an await to satisfy lint rules.
			await Promise.resolve();
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
