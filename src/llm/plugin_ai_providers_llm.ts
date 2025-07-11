import { LLM } from "./base";
import { waitForAI } from "@obsidian-ai-providers/sdk";

export class PluginAIProvidersLLM extends LLM {
    private pluginAIProviderId: string;

    constructor(pluginAIProviderId: string) {
        super();
        this.pluginAIProviderId = pluginAIProviderId;
    }

    async autocomplete(prompt: string, content: string, temperature?: number, maxOutputTokens?: number): Promise<string> {
        const { promise } = await waitForAI();
        const aiProviders = await promise;
        
        const provider = aiProviders.providers.find(p => p.id === this.pluginAIProviderId);
        if (!provider) {
            throw new Error(`Provider with id ${this.pluginAIProviderId} not found`);
        }
        
        return new Promise(async (resolve, reject) => {
            let result = '';
            
            try {
                const chunkHandler = await aiProviders.execute({
                    provider,
                    messages: [
                        { role: 'user', content: prompt },
                        { role: 'user', content: content }
                    ]
                });
                
                chunkHandler.onData((chunk: string) => {
                    result += chunk;
                });
                
                chunkHandler.onEnd(() => {
                    resolve(result);
                });
                
                chunkHandler.onError((error: Error) => {
                    reject(new Error(`Plugin AI providers API error: ${error.message}`));
                });
            } catch (error) {
                reject(new Error(`Plugin AI providers API error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    async autocompleteStreamingInner(
        prompt: string,
        content: string,
        callback: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number
    ): Promise<void> {
        const { promise } = await waitForAI();
        const aiProviders = await promise;
        
        const provider = aiProviders.providers.find(p => p.id === this.pluginAIProviderId);
        if (!provider) {
            throw new Error(`Provider with id ${this.pluginAIProviderId} not found`);
        }
        
        return new Promise(async (resolve, reject) => {
            try {
                const chunkHandler = await aiProviders.execute({
                    provider,
                    messages: [
                        { role: 'user', content: prompt },
                        { role: 'user', content: content }
                    ]
                });
                
                chunkHandler.onData((chunk: string) => {
                    callback(chunk);
                });
                
                chunkHandler.onEnd(() => {
                    resolve();
                });
                
                chunkHandler.onError((error: Error) => {
                    reject(new Error(`Plugin AI providers streaming API error: ${error.message}`));
                });
            } catch (error) {
                reject(new Error(`Plugin AI providers streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    async autocompleteStreamingInnerWithUserPrompt(
        systemPrompt: string,
        content: string,
        userPrompt: string,
        callback: (text: string) => void,
        temperature?: number,
        maxOutputTokens?: number
    ): Promise<void> {
        const { promise } = await waitForAI();
        const aiProviders = await promise;
        
        const provider = aiProviders.providers.find(p => p.id === this.pluginAIProviderId);
        if (!provider) {
            throw new Error(`Provider with id ${this.pluginAIProviderId} not found`);
        }
        
        return new Promise(async (resolve, reject) => {
            try {
                const chunkHandler = await aiProviders.execute({
                    provider,
                    messages: [
                        { role: 'user', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                        { role: 'user', content: content }
                    ]
                });
                
                chunkHandler.onData((chunk: string) => {
                    callback(chunk);
                });
                
                chunkHandler.onEnd(() => {
                    resolve();
                });
                
                chunkHandler.onError((error: Error) => {
                    reject(new Error(`Plugin AI providers streaming API error: ${error.message}`));
                });
            } catch (error) {
                reject(new Error(`Plugin AI providers streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }
}
