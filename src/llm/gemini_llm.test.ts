import { GeminiLLM } from './gemini_llm';
import type { AIProvider } from '../types';

// Mock the Google GenAI SDK
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn(),
            generateContentStream: jest.fn()
        }
    }))
}));

describe('GeminiLLM', () => {
    let geminiLLM: GeminiLLM;
    let mockProvider: AIProvider;
    let mockClient: any;

    beforeEach(() => {
        // Create a mock provider
        mockProvider = {
            id: 'test-gemini',
            name: 'Test Gemini',
            type: 'gemini',
            apiKey: 'test-api-key',
            url: 'https://generativelanguage.googleapis.com/v1beta'
        };

        // Reset all mocks
        jest.clearAllMocks();

        // Create GeminiLLM instance
        geminiLLM = new GeminiLLM(mockProvider, 'gemini-1.5-pro', false);
        
        // Get the mock client
        mockClient = (geminiLLM as any).client;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with correct parameters', () => {
            expect(geminiLLM).toBeDefined();
            expect((geminiLLM as any).modelName).toBe('gemini-1.5-pro');
        });

        it('should set useNativeFetch correctly', () => {
            const geminiWithNativeFetch = new GeminiLLM(mockProvider, 'gemini-1.5-pro', true);
            expect(geminiWithNativeFetch).toBeDefined();
        });
    });

    describe('autocomplete', () => {
        it('should successfully generate completion', async () => {
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: 'Generated completion text'
                        }]
                    }
                }]
            };
            mockClient.models.generateContent.mockResolvedValue(mockResponse);

            const result = await geminiLLM.autocomplete(
                'You are a helpful assistant',
                'Write a hello world function',
                undefined,
                0.7,
                1000
            );

            expect(result).toBe('Generated completion text');
            expect(mockClient.models.generateContent).toHaveBeenCalledWith({
                model: 'gemini-1.5-pro',
                contents: [
                    { role: 'user', parts: [{ text: 'You are a helpful assistant' }] },
                    { role: 'user', parts: [{ text: 'Write a hello world function' }] }
                ],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            });
        });

        it('should use default temperature and maxOutputTokens when not provided', async () => {
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: 'Default response'
                        }]
                    }
                }]
            };
            mockClient.models.generateContent.mockResolvedValue(mockResponse);

            await geminiLLM.autocomplete(
                'System prompt',
                'User input'
            );

            expect(mockClient.models.generateContent).toHaveBeenCalledWith({
                model: 'gemini-1.5-pro',
                contents: [
                    { role: 'user', parts: [{ text: 'System prompt' }] },
                    { role: 'user', parts: [{ text: 'User input' }] }
                ],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            });
        });

        it('should handle empty response gracefully', async () => {
            const mockResponse = { candidates: [] };
            mockClient.models.generateContent.mockResolvedValue(mockResponse);

            const result = await geminiLLM.autocomplete('prompt', 'content');
            expect(result).toBe('');
        });

        it('should handle malformed response gracefully', async () => {
            const mockResponse = { candidates: [{ content: null }] };
            mockClient.models.generateContent.mockResolvedValue(mockResponse);

            const result = await geminiLLM.autocomplete('prompt', 'content');
            expect(result).toBe('');
        });

        it('should propagate API errors with custom message', async () => {
            const apiError = new Error('API rate limit exceeded');
            mockClient.models.generateContent.mockRejectedValue(apiError);

            await expect(geminiLLM.autocomplete('prompt', 'content'))
                .rejects.toThrow('Gemini SDK error: API rate limit exceeded');
        });

        it('should handle unknown errors', async () => {
            mockClient.models.generateContent.mockRejectedValue('Unknown error');

            await expect(geminiLLM.autocomplete('prompt', 'content'))
                .rejects.toThrow('Gemini SDK error: Unknown error');
        });

        it('should have identical final result for streaming and non-streaming modes', async () => {
            const expectedText = 'Hello world response';
            
            // Setup mocks for both modes to return the same final result
            const mockNonStreamingResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: expectedText
                        }]
                    }
                }]
            };
            
            const mockStreamingResponse = {
                async *[Symbol.asyncIterator]() {
                    // Simulate streaming the same text in chunks
                    yield { candidates: [{ content: { parts: [{ text: 'Hello' }] } }] };
                    yield { candidates: [{ content: { parts: [{ text: ' world' }] } }] };
                    yield { candidates: [{ content: { parts: [{ text: ' response' }] } }] };
                }
            };

            // Test non-streaming mode
            mockClient.models.generateContent.mockResolvedValue(mockNonStreamingResponse);
            const nonStreamingCallback = jest.fn();
            const nonStreamingResult = await geminiLLM.autocomplete(
                'Test prompt',
                'Test content',
                nonStreamingCallback,
                0.7,
                1000,
                undefined,
                false
            );

            // Test streaming mode
            mockClient.models.generateContentStream.mockResolvedValue(mockStreamingResponse);
            const streamingCallback = jest.fn();
            let streamingResult = '';
            const mockStreamingCallbackWrapper = (chunk: string) => {
                streamingResult += chunk;
                streamingCallback(chunk);
            };
            
            await geminiLLM.autocomplete(
                'Test prompt',
                'Test content',
                mockStreamingCallbackWrapper,
                0.7,
                1000,
                undefined,
                true
            );

            // Verify identical final results
            expect(nonStreamingResult).toBe(expectedText);
            expect(streamingResult).toBe(expectedText);
            
            // Verify different callback behavior but same final outcome
            expect(nonStreamingCallback).toHaveBeenCalledTimes(1);
            expect(nonStreamingCallback).toHaveBeenCalledWith(expectedText);
            
            expect(streamingCallback).toHaveBeenCalledTimes(3);
            expect(streamingCallback).toHaveBeenNthCalledWith(1, 'Hello');
            expect(streamingCallback).toHaveBeenNthCalledWith(2, ' world');
            expect(streamingCallback).toHaveBeenNthCalledWith(3, ' response');
        });

        it('should not call callback in non-streaming mode when result is empty', async () => {
            const mockResponse = { candidates: [] };
            mockClient.models.generateContent.mockResolvedValue(mockResponse);

            const callback = jest.fn();
            const result = await geminiLLM.autocomplete('prompt', 'content', callback, undefined, undefined, undefined, false);

            expect(result).toBe('');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should successfully stream completion without userPrompt', async () => {
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        candidates: [{
                            content: {
                                parts: [{
                                    text: 'Hello'
                                }]
                            }
                        }]
                    };
                    yield {
                        candidates: [{
                            content: {
                                parts: [{
                                    text: ' world'
                                }]
                            }
                        }]
                    };
                    yield {
                        candidates: [{
                            content: {
                                parts: [{
                                    text: '!'
                                }]
                            }
                        }]
                    };
                }
            };
            mockClient.models.generateContentStream.mockResolvedValue(mockStream);

            const callback = jest.fn();
            await geminiLLM.autocomplete(
                'You are helpful',
                'Say hello',
                callback,
                0.8,
                500,
                undefined,
                true
            );

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 'Hello');
            expect(callback).toHaveBeenNthCalledWith(2, ' world');
            expect(callback).toHaveBeenNthCalledWith(3, '!');

            expect(mockClient.models.generateContentStream).toHaveBeenCalledWith({
                model: 'gemini-1.5-pro',
                contents: [
                    { role: 'user', parts: [{ text: 'You are helpful' }] },
                    { role: 'user', parts: [{ text: 'Say hello' }] }
                ],
                config: {
                    temperature: 0.8,
                    maxOutputTokens: 500
                }
            });
        });

        it('should handle userPrompt with system instruction for supported models', async () => {
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        candidates: [{
                            content: {
                                parts: [{
                                    text: 'Response with user prompt'
                                }]
                            }
                        }]
                    };
                }
            };
            mockClient.models.generateContentStream.mockResolvedValue(mockStream);

            const callback = jest.fn();
            await geminiLLM.autocomplete(
                'System instruction',
                'Content text',
                callback,
                0.7,
                1000,
                'User custom prompt',
                true
            );

            expect(mockClient.models.generateContentStream).toHaveBeenCalledWith({
                model: 'gemini-1.5-pro',
                contents: [
                    { role: 'user', parts: [{ text: 'User custom prompt' }] },
                    { role: 'user', parts: [{ text: 'Content text' }] }
                ],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                    systemInstruction: 'System instruction'
                }
            });
        });

        it('should handle streaming errors', async () => {
            const streamError = new Error('Streaming connection failed');
            mockClient.models.generateContentStream.mockRejectedValue(streamError);

            const callback = jest.fn();
            
            await expect(geminiLLM.autocomplete(
                'prompt',
                'content',
                callback,
                undefined,
                undefined,
                undefined,
                true
            )).rejects.toThrow('Gemini SDK error: Streaming connection failed');
        });

        it('should handle empty streaming chunks gracefully', async () => {
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield { candidates: [{ content: { parts: [{ text: 'valid' }] } }] };
                    yield { candidates: [] }; // Empty candidates
                    yield { candidates: [{ content: null }] }; // Null content
                    yield { candidates: [{ content: { parts: [] } }] }; // Empty parts
                }
            };
            mockClient.models.generateContentStream.mockResolvedValue(mockStream);

            const callback = jest.fn();
            await geminiLLM.autocomplete('prompt', 'content', callback, undefined, undefined, undefined, true);

            // Should only call callback for valid chunks
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('valid');
        });
    });

    describe('model name handling', () => {
        it('should detect Gemma models correctly', () => {
            const gemmaModels = ['gemma-7b-it', 'GEMMA-2B', 'my-gemma-model'];
            
            gemmaModels.forEach(modelName => {
                const gemmaLLM = new GeminiLLM(mockProvider, modelName, false);
                expect(gemmaLLM).toBeDefined();
            });
        });

        it('should handle non-Gemma models correctly', () => {
            const nonGemmaModels = ['gemini-1.5-pro', 'gemini-pro-vision', 'text-bison'];
            
            nonGemmaModels.forEach(modelName => {
                const regularLLM = new GeminiLLM(mockProvider, modelName, false);
                expect(regularLLM).toBeDefined();
            });
        });
    });

    describe('edge cases and error scenarios', () => {
        it('should handle network errors gracefully', async () => {
            const networkError = new Error('Network connection failed');
            mockClient.models.generateContent.mockRejectedValue(networkError);

            await expect(geminiLLM.autocomplete('prompt', 'content'))
                .rejects.toThrow('Gemini SDK error: Network connection failed');
        });

        it('should handle authentication errors', async () => {
            const authError = new Error('Invalid API key');
            mockClient.models.generateContent.mockRejectedValue(authError);

            await expect(geminiLLM.autocomplete('prompt', 'content'))
                .rejects.toThrow('Gemini SDK error: Invalid API key');
        });

        it('should handle rate limit errors', async () => {
            const rateLimitError = new Error('Rate limit exceeded');
            mockClient.models.generateContentStream.mockRejectedValue(rateLimitError);

            const callback = jest.fn();
            await expect(geminiLLM.autocomplete('prompt', 'content', callback, undefined, undefined, undefined, true))
                .rejects.toThrow('Gemini SDK error: Rate limit exceeded');
        });
    });
});