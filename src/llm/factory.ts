import { LLM } from "./base";
import { OpenAILLM } from "./openai_llm";
import { OpenAIResponsesLLM } from "./openai_responses_llm";
import { GeminiLLM } from "./gemini_llm";
import { OllamaLLM } from "./ollama_llm";
import { GroqLLM } from "./groq_llm";
import { OpenRouterLLM } from "./openrouter_llm";
import { LMStudioLLM } from "./lmstudio_llm";
import { AnthropicLLM } from "./anthropic_llm";
import { PluginAIProvidersLLM } from "./plugin_ai_providers_llm";
import { OpenAIModel } from "./openai_llm";
import type { AIEditorSettings } from "../settings";
import type { AIModel, AIProvider } from "../types";

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

	private createLLMInstance(
		provider: AIProvider,
		modelName: string,
		modelSettings?: AIModel
	): LLM {
		if (!provider.apiKey) {
			throw new Error(
				`API key not configured for provider: ${provider.name}`
			);
		}

		const useNativeFetch = this.settings.useNativeFetch || false;
		const resolvedModelSettings =
			modelSettings ||
			this.settings.aiProviders?.models.find(
				m => m.providerId === provider.id && m.modelName === modelName
			);
		const temperatureSupported =
			resolvedModelSettings?.temperatureSupported ?? true;
		const reasoningSummarySupported =
			resolvedModelSettings?.reasoningSummarySupported ?? true;

		switch (provider.type) {
			case "openai":
				if (resolvedModelSettings?.openAIRequestMode === "responses") {
					return new OpenAIResponsesLLM(
						modelName as OpenAIModel,
						provider.apiKey,
						provider.url,
						temperatureSupported,
						reasoningSummarySupported
					);
				}

				return new OpenAILLM(
					modelName as OpenAIModel,
					provider.apiKey,
					provider.url,
					temperatureSupported
				);
			case "anthropic":
				return new AnthropicLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
			case "gemini":
				return new GeminiLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
			case "ollama":
				return new OllamaLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
			case "groq":
				return new GroqLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
			case "openrouter":
				return new OpenRouterLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
			case "lmstudio":
				return new LMStudioLLM(
					provider,
					modelName,
					useNativeFetch,
					temperatureSupported
				);
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
		providerId?: string,
		modelOverride?: AIModel
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
		let modelSettings = modelOverride;
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
			modelSettings = model;

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

		return this.createLLMInstance(provider, modelName, modelSettings);
	}
}
