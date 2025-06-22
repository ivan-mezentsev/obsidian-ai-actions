import { BaseProviderLLM } from "./base_provider_llm";
import { AIProvider } from "../types";

export class GeminiLLM extends BaseProviderLLM {
    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false, debugMode: boolean = false) {
        super(provider, modelName, useNativeFetch, debugMode);
    }

    protected getDefaultBaseUrl(): string {
        return 'https://generativelanguage.googleapis.com/v1beta';
    }

    protected getBaseUrl(): string {
        // For Gemini, ensure we use the correct base URL
        const url = this.provider.url || this.getDefaultBaseUrl();
        // If URL contains /openai, replace it with empty string to get base URL
        // If URL already ends with /v1beta, use it as is
        if (url.includes('/openai')) {
            return url.replace('/openai', '');
        }
        return url;
    }

    protected getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.provider.apiKey) {
            // Gemini uses API key as query parameter, not in headers
            // But we'll keep it in headers for consistency with other providers
            headers['x-goog-api-key'] = this.provider.apiKey;
        }

        return headers;
    }

    async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
		const systemPrompt = prompt;
		const userContent = content;
        
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{
                        text: systemPrompt
                    }]
                },
                {
                    role: 'user', 
                    parts: [{
                        text: userContent
                    }]
                }
            ],
            generationConfig: {
                temperature: temperature !== undefined ? temperature : 0.7,
                maxOutputTokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
            }
        };

        const endpoint = `/models/${this.modelName}:generateContent?key=${this.provider.apiKey}`;
        const response = await this.makeRequest(endpoint, body);
        
        if (!response.ok) {
            if (this.debugMode) {
                console.log(`[AI Actions Debug] Gemini API error: ${response.status} ${response.statusText}`);
                try {
                    const errorText = await response.text();
                    console.log(`[AI Actions Debug] Error response body:`, errorText);
                } catch (e) {
                    console.log(`[AI Actions Debug] Could not read error response body`);
                }
            }
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text || '';
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
		const systemPrompt = prompt;
		const userContent = content;
        
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{
                        text: systemPrompt
                    }]
                },
                {
                    role: 'user',
                    parts: [{
                        text: userContent
                    }]
                }
            ],
            generationConfig: {
                temperature: temperature !== undefined ? temperature : 0.7,
                maxOutputTokens: maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 1000,
            }
        };

        const endpoint = `/models/${this.modelName}:streamGenerateContent?key=${this.provider.apiKey}`;
        const response = await this.makeRequest(endpoint, body);
        
        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
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
                
                // Try to parse the entire buffer as JSON array first
                try {
                    const jsonData = JSON.parse(buffer);
                    if (Array.isArray(jsonData)) {
                        // Gemini returns array of response objects
                        for (const item of jsonData) {
                            if (item.candidates && item.candidates[0] && item.candidates[0].content) {
                                const text = item.candidates[0].content.parts[0].text;
                                if (text) {
                                    callback(text);
                                }
                            }
                        }
                        buffer = ''; // Clear buffer after successful parse
                        continue;
                    }
                } catch (e) {
                    // Not a complete JSON yet, continue reading
                }
                
                // Fallback: try line-by-line parsing for SSE format
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() && line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            if (jsonStr.trim() === '[DONE]') break;
                            
                            const data = JSON.parse(jsonStr);
                            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                                const text = data.candidates[0].content.parts[0].text;
                                if (text) {
                                    callback(text);
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }
            
            // Process any remaining buffer content
            if (buffer.trim()) {
                try {
                    const jsonData = JSON.parse(buffer);
                    if (Array.isArray(jsonData)) {
                        for (const item of jsonData) {
                            if (item.candidates && item.candidates[0] && item.candidates[0].content) {
                                const text = item.candidates[0].content.parts[0].text;
                                if (text) {
                                    callback(text);
                                }
                            }
                        }
                    } else if (jsonData.candidates && jsonData.candidates[0] && jsonData.candidates[0].content) {
                        const text = jsonData.candidates[0].content.parts[0].text;
                        if (text) {
                            callback(text);
                        }
                    }
                } catch (e) {
                    // Ignore final parsing errors
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    protected async makeRequest(endpoint: string, body: any): Promise<Response> {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const fetchFn = this.getFetch();
        const headers = {
            'Content-Type': 'application/json',
        };
        const requestBody = JSON.stringify(body);
        
        if (this.debugMode) {
            console.log(`[AI Actions Debug] Request to ${url}`);
            console.log(`[AI Actions Debug] Headers:`, headers);
            console.log(`[AI Actions Debug] Body:`, requestBody);
        }
        
        try {
            const response = await fetchFn(url, {
                method: 'POST',
                headers: headers,
                body: requestBody,
            });
            
            if (this.debugMode) {
                console.log(`[AI Actions Debug] Response status: ${response.status}`);
                
                // Log headers
                const headersObj: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    headersObj[key] = value;
                });
                console.log(`[AI Actions Debug] Response headers:`, headersObj);
                
                // Clone response to read body without consuming it
                const responseClone = response.clone();
                try {
                    const responseText = await responseClone.text();
                    console.log(`[AI Actions Debug] Response body:`, responseText);
                } catch (error) {
                    console.log(`[AI Actions Debug] Could not read response body:`, error);
                }
            }
            
            return response;
        } catch (error) {
            if (this.debugMode) {
                console.log(`[AI Actions Debug] Request failed with error:`, error);
            }
            throw error;
        }
    }
}