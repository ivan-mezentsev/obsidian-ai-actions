import { BaseProviderLLM } from "./base_provider_llm";
import type { AIProvider } from "../types";
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicLLM extends BaseProviderLLM {
    private client: Anthropic;

    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false, debugMode: boolean = false) {
        super(provider, modelName, useNativeFetch, debugMode);
        
        this.client = new Anthropic({
            apiKey: provider.apiKey,
            baseURL: provider.url || this.getDefaultBaseUrl(),
            dangerouslyAllowBrowser: true
        });
    }

    protected getDefaultBaseUrl(): string {
        return 'https://api.anthropic.com';
    }

    protected getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        };

        if (this.provider.apiKey) {
            headers['x-api-key'] = this.provider.apiKey;
        }

        return headers;
    }

    async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
        const systemPrompt = prompt;
        const userContent = content;
        
        try {
            const message = await this.client.messages.create({
                model: this.modelName,
                max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
                temperature: temperature !== undefined ? temperature : 0.7,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userContent
                    }
                ]
            });

            if (message.content && message.content.length > 0) {
                const textBlock = message.content.find((block: any) => block.type === 'text');
                if (textBlock && 'text' in textBlock) {
                    return textBlock.text;
                }
            }
            
            return '';
        } catch (error) {
            if (this.debugMode) {
                console.error('Anthropic API error:', error);
            }
            throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async autocompleteStreamingInner(
        prompt: string,
        content: string,
        callback: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number
    ): Promise<void> {
        const systemPrompt = prompt;
        const userContent = content;
        
        try {
            const stream = await this.client.messages.create({
                model: this.modelName,
                max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
                temperature: temperature !== undefined ? temperature : 0.7,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userContent
                    }
                ],
                stream: true
            });

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    callback(chunk.delta.text);
                }
            }
        } catch (error) {
            if (this.debugMode) {
                console.error('Anthropic streaming API error:', error);
            }
            throw new Error(`Anthropic streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        try {
            const stream = await this.client.messages.create({
                model: this.modelName,
                max_tokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
                temperature: temperature !== undefined ? temperature : 0.7,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt
                    },
                    {
                        role: 'user',
                        content: content
                    }
                ],
                stream: true
            });

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    callback(chunk.delta.text);
                }
            }
        } catch (error) {
            if (this.debugMode) {
                console.error('Anthropic streaming API error:', error);
            }
            throw new Error(`Anthropic streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}