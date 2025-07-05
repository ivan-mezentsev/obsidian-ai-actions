import { LLM } from "./base";
import type { AIProvider } from "../types";
import { nativeFetch, standardFetch } from "../utils/fetch";
import type { AIEditorSettings } from "../settings";

export abstract class BaseProviderLLM extends LLM {
    protected provider: AIProvider;
    protected modelName: string;
    protected useNativeFetch: boolean;

    constructor(provider: AIProvider, modelName: string, useNativeFetch: boolean = false) {
        super();
        this.provider = provider;
        this.modelName = modelName;
        this.useNativeFetch = useNativeFetch;
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
        
        try {
            const response = await fetchFn(url, {
                method: 'POST',
                headers: headers,
                body: requestBody,
            });
            
            return response;
        } catch (error) {
            throw error;
        }
    }
}