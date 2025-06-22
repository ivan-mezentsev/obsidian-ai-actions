import { LLM } from "./base";
import { AIProvider } from "../types";
import { nativeFetch, standardFetch } from "../utils/fetch";
import { AIEditorSettings } from "../settings";

export abstract class BaseProviderLLM extends LLM {
    protected provider: AIProvider;
    protected modelName: string;
    protected useNativeFetch: boolean;
    protected debugMode: boolean;

    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false, debugMode: boolean = false) {
        super();
        this.provider = provider;
        this.modelName = modelName;
        this.useNativeFetch = useNativeFetch;
        this.debugMode = debugMode;
    }

    protected getFetch(): typeof fetch {
        return this.useNativeFetch ? nativeFetch : standardFetch;
    }

    protected getBaseUrl(): string {
        return this.provider.url || this.getDefaultBaseUrl();
    }

    protected abstract getDefaultBaseUrl(): string;

    protected getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.provider.apiKey) {
            headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
        }

        return headers;
    }

    protected async makeRequest(endpoint: string, body: any): Promise<Response> {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const fetchFn = this.getFetch();
        const headers = this.getHeaders();
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