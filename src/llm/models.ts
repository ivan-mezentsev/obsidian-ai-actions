import type { AIModel } from "../types";
import { OpenAIModel } from "./openai_llm";

export type Model = OpenAIModel | AIModel | {};

// Legacy default model for backward compatibility
export const DEFAULT_MODEL = OpenAIModel.GPT_4O_MINI;

// Helper function to get default model from settings
export function getDefaultModel(models: AIModel[]): AIModel | undefined {
	return models.length > 0 ? models[0] : undefined;
}
