import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";

export class LMStudioLLM extends BaseProviderLLM {
    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false) {
        super(provider, modelName, useNativeFetch);
    }

    protected getDefaultBaseUrl(): string {
        return 'http://localhost:1234/v1';
    }

    protected getHeaders(): Record<string, string> {
        // LMStudio typically doesn't require authorization for local instances
        // but we'll include the API key if provided
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.provider.apiKey) {
            headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
        }

        return headers;
    }

    async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
        
        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'system',
                    content: prompt
                },
                {
                    role: 'user',
                    content: content
                }
            ],
            temperature: temperature !== undefined ? temperature : 0.7,
            max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
            stream: false
        };

        const response = await this.makeRequest('/chat/completions', body);
        
        if (!response.ok) {
            throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content || '';
        }
        
        return '';
    }

    async autocompleteStreamingInner(
        prompt: string,
        content: string,
        callback: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number
    ): Promise<void> {
        
        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'system',
                    content: prompt
                },
                {
                    role: 'user',
                    content: content
                }
            ],
            temperature: temperature !== undefined ? temperature : 0.7,
            max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
            stream: true
        };

        const response = await this.makeRequest('/chat/completions', body);
        
        if (!response.ok) {
            throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`);
        }

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
                    if (line.trim() && line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE]') break;
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.choices && data.choices[0] && data.choices[0].delta) {
                                const content = data.choices[0].delta.content;
                                if (content) {
                                    callback(content);
                                }
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
    }

    async autocompleteStreamingInnerWithUserPrompt(
        systemPrompt: string,
        content: string,
        userPrompt: string,
        callback: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number
    ): Promise<void> {
        const body = {
            model: this.modelName,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                },
                {
                    role: 'user',
                    content: content
                }
            ],
            temperature: temperature !== undefined ? temperature : 0.7,
            max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
            stream: true
        };

        const response = await this.makeRequest('/chat/completions', body);
        
        if (!response.ok) {
            throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`);
        }

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
                    if (line.trim() && line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE]') break;
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.choices && data.choices[0] && data.choices[0].delta) {
                                const content = data.choices[0].delta.content;
                                if (content) {
                                    callback(content);
                                }
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
    }
}