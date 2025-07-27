// Mock Response interface and helper functions for testing
export interface MockResponseInit {
	ok?: boolean;
	status?: number;
	statusText?: string;
	headers?: Record<string, string>;
	body?: any;
}

export interface MockReadableStreamReader {
	read: jest.Mock<Promise<{ done: boolean; value?: Uint8Array }>>;
	releaseLock: jest.Mock<void>;
}

export class MockResponse implements Response {
	ok: boolean;
	status: number;
	statusText: string;
	headers: any;
	body: any;
	redirected: boolean = false;
	type: any = "basic";
	url: string = "";
	bodyUsed: boolean = false;

	private jsonMock: jest.Mock;
	private textMock: jest.Mock;
	private arrayBufferMock: jest.Mock;
	private blobMock: jest.Mock;
	private formDataMock: jest.Mock;
	private bytesMock: jest.Mock;

	constructor(init: MockResponseInit = {}) {
		this.ok = init.ok ?? true;
		this.status = init.status ?? 200;
		this.statusText = init.statusText ?? "OK";
		this.headers = init.headers || {};
		this.body = init.body ?? null;

		this.jsonMock = jest.fn();
		this.textMock = jest.fn();
		this.arrayBufferMock = jest.fn();
		this.blobMock = jest.fn();
		this.formDataMock = jest.fn();
		this.bytesMock = jest.fn();
	}

	// Body methods
	async json(): Promise<any> {
		this.bodyUsed = true;
		return this.jsonMock();
	}

	async text(): Promise<string> {
		this.bodyUsed = true;
		return this.textMock();
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		this.bodyUsed = true;
		return this.arrayBufferMock();
	}

	async blob(): Promise<any> {
		this.bodyUsed = true;
		return this.blobMock();
	}

	async formData(): Promise<any> {
		this.bodyUsed = true;
		return this.formDataMock();
	}

	async bytes(): Promise<Uint8Array> {
		this.bodyUsed = true;
		return this.bytesMock();
	}

	clone(): Response {
		return new MockResponse({
			ok: this.ok,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			body: this.body,
		}) as Response;
	}

	// Mock setters for test control
	setJsonResponse(data: any): void {
		this.jsonMock.mockResolvedValue(data);
	}

	setTextResponse(text: string): void {
		this.textMock.mockResolvedValue(text);
	}

	setStreamReader(reader: MockReadableStreamReader): void {
		this.body = {
			getReader: jest.fn().mockReturnValue(reader),
		} as any;
	}

	static createWithReader(
		reader: MockReadableStreamReader,
		init: MockResponseInit = {}
	): MockResponse {
		const response = new MockResponse(init);
		response.body = {
			getReader: jest.fn().mockReturnValue(reader),
		} as any;
		return response;
	}
}

export function createMockResponse(init: MockResponseInit = {}): MockResponse {
	return new MockResponse(init);
}

export function createMockStreamReader(): MockReadableStreamReader {
	return {
		read: jest.fn(),
		releaseLock: jest.fn(),
	};
}
