import { requestUrl, RequestUrlParam } from "obsidian";

// Native fetch wrapper that uses Obsidian's requestUrl to bypass CORS
export async function nativeFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Remove content-length header as it's handled automatically
    if (options.headers) {
        delete (options.headers as Record<string, string>)["content-length"];
    }
    
    const requestParams: RequestUrlParam = {
        url,
        method: options.method || 'GET',
        headers: options.headers as Record<string, string>,
    };

    if (options.body) {
        requestParams.body = options.body as string;
    }

    try {
        const obsidianResponse = await requestUrl(requestParams);
        
        const responseInit: ResponseInit = {
            status: obsidianResponse.status,
            headers: obsidianResponse.headers,
        };

        return new Response(obsidianResponse.text, responseInit);
    } catch (error) {
        throw error;
    }
}

// Standard fetch for environments that support it
export const standardFetch = globalThis.fetch?.bind(globalThis) || fetch;