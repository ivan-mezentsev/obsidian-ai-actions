import { LLM } from "./base";
import { OpenAILLM } from "./openai_llm";
import { GeminiLLM } from "./gemini_llm";
import { OllamaLLM } from "./ollama_llm";
import { GroqLLM } from "./groq_llm";
import { OpenRouterLLM } from "./openrouter_llm";
import { LMStudioLLM } from "./lmstudio_llm";
import { AnthropicLLM } from "./anthropic_llm";
import { PluginAIProvidersLLM } from "./plugin_ai_providers_llm";
import { OpenAIModel } from "./openai_llm";
import type { AIEditorSettings } from "../settings";
import type { AIProvider } from "../types";

export class LLMFactory {
	private settings: AIEditorSettings;

	constructor(settings: AIEditorSettings) {
		this.settings = settings;
	}

	async getProviderName(modelId: string): Promise<string> {
		// Handle plugin AI providers
		if (modelId.startsWith("plugin_ai_providers_")) {
			try {
				const pluginAIProviderId = modelId.replace(
					"plugin_ai_providers_",
					""
				);
				const { waitForAI } = await import(
					"@obsidian-ai-providers/sdk"
				);
				const aiProvidersWaiter = await waitForAI();
				const aiProviders = await aiProvidersWaiter.promise;

				const provider = aiProviders.providers.find(
					(p: { id: string; name: string; model?: string }) =>
						p.id === pluginAIProviderId
				);
				if (provider) {
					return provider.model
						? `${provider.name} ~ ${provider.model}`
						: provider.name;
				}
			} catch (error) {
				console.error("Failed to get plugin AI provider name:", error);
			}
			return "Plugin AI Providers";
		}

		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(
			m => m.id === modelId
		);
		if (!model) {
			return "Unknown";
		}

		const provider = this.settings.aiProviders?.providers.find(
			p => p.id === model.providerId
		);
		if (!provider) {
			return "Unknown";
		}

		return provider.name;
	}

	// Synchronous version for backward compatibility
	getProviderNameSync(modelId: string): string {
		// Handle plugin AI providers (synchronous fallback)
		if (modelId.startsWith("plugin_ai_providers_")) {
			return "Plugin AI Providers";
		}

		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(
			m => m.id === modelId
		);
		if (!model) {
			return "Unknown";
		}

		const provider = this.settings.aiProviders?.providers.find(
			p => p.id === model.providerId
		);
		if (!provider) {
			return "Unknown";
		}

		return provider.name;
	}

	getSystemPromptSupport(modelId: string): boolean {
		// Handle new provider-based models
		const model = this.settings.aiProviders?.models.find(
			m => m.id === modelId
		);
		if (!model) {
			return true; // Default to true when model not found
		}

		return model.systemPromptSupport ?? true;
	}

	private createLLMInstance(provider: AIProvider, modelName: string): LLM {
		if (!provider.apiKey) {
			throw new Error(
				`API key not configured for provider: ${provider.name}`
			);
		}

		const useNativeFetch = this.settings.useNativeFetch || false;

		switch (provider.type) {
			case "openai":
				return new OpenAILLM(
					modelName as OpenAIModel,
					provider.apiKey,
					provider.url
				);
			case "anthropic":
				return new AnthropicLLM(provider, modelName, useNativeFetch);
			case "gemini":
				return new GeminiLLM(provider, modelName, useNativeFetch);
			case "ollama":
				return new OllamaLLM(provider, modelName, useNativeFetch);
			case "groq":
				return new GroqLLM(provider, modelName, useNativeFetch);
			case "openrouter":
				return new OpenRouterLLM(provider, modelName, useNativeFetch);
			case "lmstudio":
				return new LMStudioLLM(provider, modelName, useNativeFetch);
			default: {
				const providerType = (provider as unknown as { type: string })
					.type;
				throw new Error(`Unsupported provider type: ${providerType}`);
			}
		}
	}

	create(
		modelId: string,
		overrideModelName?: string,
		providerId?: string
	): LLM {
		// Handle plugin AI providers
		if (modelId.startsWith("plugin_ai_providers_")) {
			const pluginAIProviderId = modelId.replace(
				"plugin_ai_providers_",
				""
			);
			return new PluginAIProvidersLLM(pluginAIProviderId);
		}

		// Find or determine provider
		let provider;
		if (providerId) {
			// Use provided provider ID
			provider = this.settings.aiProviders?.providers.find(
				p => p.id === providerId
			);
			if (!provider) {
				throw new Error(`Provider not found: ${providerId}`);
			}
		} else {
			// Find model first, then get its provider
			const model = this.settings.aiProviders?.models.find(
				m => m.id === modelId
			);
			if (!model) {
				throw new Error(`Model not found: ${modelId}`);
			}

			provider = this.settings.aiProviders?.providers.find(
				p => p.id === model.providerId
			);
			if (!provider) {
				throw new Error(`Provider not found for model: ${modelId}`);
			}
		}

		// Determine model name
		const modelName =
			overrideModelName ||
			(() => {
				if (!overrideModelName) {
					const model = this.settings.aiProviders?.models.find(
						m => m.id === modelId
					);
					return model?.modelName;
				}
				return overrideModelName;
			})();

		if (!modelName) {
			throw new Error(`Model name not found for model: ${modelId}`);
		}

		return this.createLLMInstance(provider, modelName);
	}
}
