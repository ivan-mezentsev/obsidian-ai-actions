// Mock Response interface and helper functions for testing
export interface MockResponseInit {
	ok?: boolean;
	status?: number;
	statusText?: string;
	headers?: Record<string, string>;
	body?: unknown;
}

export interface MockReadableStreamReader {
	read: jest.Mock<Promise<{ done: boolean; value?: Uint8Array }>, []>;
	releaseLock: jest.Mock<void, []>;
}

export class MockResponse implements Response {
	ok: boolean;
	status: number;
	statusText: string;
	headers: Headers;
	body: ReadableStream<Uint8Array> | null;
	redirected: boolean = false;
	type: ResponseType = "basic";
	url: string = "";
	bodyUsed: boolean = false;

	private jsonMock: jest.Mock<Promise<unknown>, []>;
	private textMock: jest.Mock<Promise<string>, []>;
	private arrayBufferMock: jest.Mock<Promise<ArrayBuffer>, []>;
	private blobMock: jest.Mock<Promise<Blob>, []>;
	private formDataMock: jest.Mock<Promise<FormData>, []>;
	private bytesMock: jest.Mock<Promise<Uint8Array>, []>;

	constructor(init: MockResponseInit = {}) {
		this.ok = init.ok ?? true;
		this.status = init.status ?? 200;
		this.statusText = init.statusText ?? "OK";
		this.headers = new Headers(init.headers || {});
		this.body = null;

		this.jsonMock = jest.fn<Promise<unknown>, []>();
		this.textMock = jest.fn<Promise<string>, []>();
		this.arrayBufferMock = jest.fn<Promise<ArrayBuffer>, []>();
		this.blobMock = jest.fn<Promise<Blob>, []>();
		this.formDataMock = jest.fn<Promise<FormData>, []>();
		this.bytesMock = jest.fn<Promise<Uint8Array>, []>();

		// If the test provides a body, keep it as the response body.
		// Many tests use a mocked stream-like object with getReader().
		if (init.body != null) {
			this.body = init.body as unknown as ReadableStream<Uint8Array>;
		}
	}

	// Body methods
	json(): Promise<unknown> {
		this.bodyUsed = true;
		return this.jsonMock();
	}

	text(): Promise<string> {
		this.bodyUsed = true;
		return this.textMock();
	}

	arrayBuffer(): Promise<ArrayBuffer> {
		this.bodyUsed = true;
		return this.arrayBufferMock();
	}

	blob(): Promise<Blob> {
		this.bodyUsed = true;
		return this.blobMock();
	}

	formData(): Promise<FormData> {
		this.bodyUsed = true;
		return this.formDataMock();
	}

	bytes(): Promise<Uint8Array> {
		this.bodyUsed = true;
		return this.bytesMock();
	}

	clone(): Response {
		return new MockResponse({
			ok: this.ok,
			status: this.status,
			statusText: this.statusText,
			headers: Object.fromEntries(this.headers.entries()),
			body: this.body,
		}) as Response;
	}

	// Mock setters for test control
	setJsonResponse(data: unknown): void {
		this.jsonMock.mockResolvedValue(data);
	}

	setTextResponse(text: string): void {
		this.textMock.mockResolvedValue(text);
	}

	setStreamReader(reader: MockReadableStreamReader): void {
		this.body = {
			getReader: jest
				.fn<MockReadableStreamReader, []>()
				.mockReturnValue(reader),
		} as unknown as ReadableStream<Uint8Array>;
	}

	static createWithReader(
		reader: MockReadableStreamReader,
		init: MockResponseInit = {}
	): MockResponse {
		const response = new MockResponse(init);
		response.body = {
			getReader: jest
				.fn<MockReadableStreamReader, []>()
				.mockReturnValue(reader),
		} as unknown as ReadableStream<Uint8Array>;
		return response;
	}
}

export function createMockResponse(init: MockResponseInit = {}): MockResponse {
	return new MockResponse(init);
}

export function createMockStreamReader(): MockReadableStreamReader {
	return {
		read: jest.fn<Promise<{ done: boolean; value?: Uint8Array }>, []>(),
		releaseLock: jest.fn<void, []>(),
	};
}
