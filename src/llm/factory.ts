import { LLM } from "./base";
import { OpenAILLM } from "./openai_llm";
import { DummyLLM } from "./dummy_llm";
import { GeminiLLM } from "./gemini_llm";
import { OllamaLLM } from "./ollama_llm";
import { GroqLLM } from "./groq_llm";
import { OpenRouterLLM } from "./openrouter_llm";
import { LMStudioLLM } from "./lmstudio_llm";
import { OpenAIModel } from "./openai_llm";
import { AIEditorSettings } from "../settings";
import { Model } from "./models";
import { AIModel, AIProvider } from "../types";

export class LLMFactory {
	private settings: AIEditorSettings;

	constructor(settings: AIEditorSettings) {
		this.settings = settings;
	}

	create(modelId: string): LLM {
		// Handle legacy OpenAI models
		if (Object.values(OpenAIModel).includes(modelId as OpenAIModel)) {
			if (this.settings.openAiApiKey) {
				return new OpenAILLM(
					modelId as OpenAIModel,
					this.settings.openAiApiKey
				);
			} else if (this.settings.testingMode) {
				return new DummyLLM();
			} else {
				throw new Error("OpenAI API key is required");
			}
		}

		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(m => m.id === modelId);
		if (!model) {
			if (this.settings.testingMode) {
				return new DummyLLM();
			}
			throw new Error(`Model not found: ${modelId}`);
		}

		const provider = this.settings.aiProviders?.providers.find(p => p.id === model.providerId);
		if (!provider) {
			if (this.settings.testingMode) {
				return new DummyLLM();
			}
			throw new Error(`Provider not found for model: ${modelId}`);
		}

		if (!provider.apiKey) {
			if (this.settings.testingMode) {
				return new DummyLLM();
			}
			throw new Error(`API key not configured for provider: ${provider.name}`);
		}

		// Create LLM instance based on provider type
		const useNativeFetch = this.settings.useNativeFetch || false;
		const debugMode = this.settings.debugMode || false;
		
		switch (provider.type) {
			case "openai":
				return new OpenAILLM(
					model.modelName as OpenAIModel,
					provider.apiKey,
					provider.url,
					debugMode
				);
			case "gemini":
				return new GeminiLLM(provider, model.modelName, useNativeFetch, debugMode);
			case "ollama":
				return new OllamaLLM(provider, model.modelName, useNativeFetch, debugMode);
			case "groq":
				return new GroqLLM(provider, model.modelName, useNativeFetch, debugMode);
			case "openrouter":
				return new OpenRouterLLM(provider, model.modelName, useNativeFetch, debugMode);
			case "lmstudio":
				return new LMStudioLLM(provider, model.modelName, useNativeFetch, debugMode);
			default:
				if (this.settings.testingMode) {
					return new DummyLLM();
				}
				throw new Error(`Unsupported provider type: ${provider.type}`);
		}
	}
}
