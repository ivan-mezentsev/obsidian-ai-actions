import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";

export class OllamaLLM extends BaseProviderLLM {
    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false) {
        super(provider, modelName, useNativeFetch);
    }

    protected getDefaultBaseUrl(): string {
        return 'http://localhost:11434';
    }

    protected getHeaders(): Record<string, string> {
        // Ollama typically doesn't require authorization headers for local instances
        return {
            'Content-Type': 'application/json',
        };
    }

    async autocomplete(
        prompt: string,
        content: string,
        callback?: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number,
        userPrompt?: string,
        streaming: boolean = false
    ): Promise<string | void> {
        const combinedPrompt = userPrompt 
            ? prompt + '\n' + userPrompt + '\n' + content
            : prompt + '\n' + content;
        const body = {
            model: this.modelName,
            prompt: combinedPrompt,
            stream: streaming,
            options: {
                temperature: temperature !== undefined ? temperature : 0.7,
                ...(maxOutputTokens && maxOutputTokens > 0 ? { num_predict: maxOutputTokens } : { num_predict: 1000 }),
            }
        };

        const response = await this.makeRequest('/api/generate', body);
        
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        if (streaming && callback) {
            // Streaming mode
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                if (data.response) {
                                    callback(data.response);
                                }
                                if (data.done) {
                                    return;
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            return;
        } else {
            // Non-streaming mode
            const data = await response.json();
            return data.response || '';
        }
    }
}