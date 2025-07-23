import { LLM } from "./base";
import { OpenAILLM } from "./openai_llm";
import { DummyLLM } from "./dummy_llm";
import { GeminiLLM } from "./gemini_llm";
import { OllamaLLM } from "./ollama_llm";
import { GroqLLM } from "./groq_llm";
import { OpenRouterLLM } from "./openrouter_llm";
import { LMStudioLLM } from "./lmstudio_llm";
import { AnthropicLLM } from "./anthropic_llm";
import { PluginAIProvidersLLM } from "./plugin_ai_providers_llm";
import { OpenAIModel } from "./openai_llm";
import type { AIEditorSettings } from "../settings";
import type { AIModel } from "../types";

export class LLMFactory {
	private settings: AIEditorSettings;

	constructor(settings: AIEditorSettings) {
		this.settings = settings;
	}

	async getProviderName(modelId: string): Promise<string> {
		// Handle plugin AI providers
		if (modelId.startsWith('plugin_ai_providers_')) {
			try {
				const pluginAIProviderId = modelId.replace('plugin_ai_providers_', '');
				const { waitForAI } = await import("@obsidian-ai-providers/sdk");
				const aiProvidersWaiter = await waitForAI();
				const aiProviders = await aiProvidersWaiter.promise;
				
				const provider = aiProviders.providers.find((p: { id: string; name: string; model?: string }) => p.id === pluginAIProviderId);
				if (provider) {
					return provider.model ? `${provider.name} ~ ${provider.model}` : provider.name;
				}
			} catch (error) {
				console.error('Failed to get plugin AI provider name:', error);
			}
			return "Plugin AI Providers";
		}

		// Handle legacy OpenAI models
		if (Object.values(OpenAIModel).includes(modelId as OpenAIModel)) {
			return "OpenAI";
		}

		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(m => m.id === modelId);
		if (!model) {
			return "Unknown";
		}

		const provider = this.settings.aiProviders?.providers.find(p => p.id === model.providerId);
		if (!provider) {
			return "Unknown";
		}

		return provider.name;
	}

	// Synchronous version for backward compatibility
	getProviderNameSync(modelId: string): string {
		// Handle legacy OpenAI models
		if (Object.values(OpenAIModel).includes(modelId as OpenAIModel)) {
			return "OpenAI";
		}

		// Handle plugin AI providers (synchronous fallback)
		if (modelId.startsWith('plugin_ai_providers_')) {
			return "Plugin AI Providers";
		}

		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(m => m.id === modelId);
		if (!model) {
			return "Unknown";
		}

		const provider = this.settings.aiProviders?.providers.find(p => p.id === model.providerId);
		if (!provider) {
			return "Unknown";
		}

		return provider.name;
	}

	create(modelId: string): LLM {
		// Handle plugin AI providers
		if (modelId.startsWith('plugin_ai_providers_')) {
			const pluginAIProviderId = modelId.replace('plugin_ai_providers_', '');
			return new PluginAIProvidersLLM(pluginAIProviderId);
		}

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
		
		switch (provider.type) {
			case "openai":
				return new OpenAILLM(
					model.modelName as OpenAIModel,
					provider.apiKey,
					provider.url,
				);
			case "anthropic":
				return new AnthropicLLM(provider, model.modelName, useNativeFetch);
			case "gemini":
				return new GeminiLLM(provider, model.modelName, useNativeFetch);
			case "ollama":
				return new OllamaLLM(provider, model.modelName, useNativeFetch);
			case "groq":
				return new GroqLLM(provider, model.modelName, useNativeFetch);
			case "openrouter":
				return new OpenRouterLLM(provider, model.modelName, useNativeFetch);
			case "lmstudio":
				return new LMStudioLLM(provider, model.modelName, useNativeFetch);
			default:
				if (this.settings.testingMode) {
					return new DummyLLM();
				}
				throw new Error(`Unsupported provider type: ${provider.type}`);
		}
	}
}
