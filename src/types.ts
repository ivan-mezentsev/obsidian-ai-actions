export type AIProviderType = 'openai' | 'ollama' | 'gemini' | 'openrouter' | 'lmstudio' | 'groq' | 'anthropic';

export interface AIProvider {
    id: string;
    name: string;
    type: AIProviderType;
    apiKey?: string;
    url?: string;
    availableModels?: string[];
}

export interface AIModel {
    id: string;
    name: string;
    providerId: string;
    modelName: string;
}

export interface AIProvidersSettings {
    providers: AIProvider[];
    models: AIModel[];
    defaultModelId?: string;
}