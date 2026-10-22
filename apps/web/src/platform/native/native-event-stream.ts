/**
 * Server-sent events over `fetch`, for the iOS/Android shell: `EventSource`
 * cannot send the `Authorization` header the shell's session needs. Only the
 * parts of the format the API uses: `event:`, `data:` and comments.
 */

export interface EventStreamHandlers {
	onOpen: () => void;
	onEvent: (event: string, data: string) => void;
	/** The stream ended or failed; `retry` tells a refusal (4xx) from a drop. */
	onClose: (retry: boolean) => void;
}

/** Splits buffered text into complete events, returning the unfinished tail. */
export function takeEvents(
	buffer: string,
	emit: (event: string, data: string) => void,
): string {
	const blocks = buffer.replace(/\r\n?/g, "\n").split("\n\n");
	const tail = blocks.pop() ?? "";
	for (const block of blocks) {
		let event = "message";
		const data: string[] = [];
		for (const line of block.split("\n")) {
			if (line.startsWith(":")) continue;
			const colon = line.indexOf(":");
			const field = colon === -1 ? line : line.slice(0, colon);
			const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
			if (field === "event") event = value;
			else if (field === "data") data.push(value);
		}
		if (data.length > 0) emit(event, data.join("\n"));
	}
	return tail;
}

/** Opens the stream; the returned function closes it. */
export function openEventStream(
	url: string,
	headers: Record<string, string>,
	handlers: EventStreamHandlers,
): () => void {
	const abort = new AbortController();
	const run = async () => {
		const response = await fetch(url, {
			headers: { ...headers, Accept: "text/event-stream" },
			credentials: "omit",
			signal: abort.signal,
		});
		if (!response.ok || response.body === null) {
			handlers.onClose(response.status >= 500);
			return;
		}
		handlers.onOpen();
		const reader = response.body
			.pipeThrough(new TextDecoderStream())
			.getReader();
		let buffer = "";
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer = takeEvents(buffer + value, handlers.onEvent);
		}
		handlers.onClose(true);
	};
	run().catch(() => {
		if (!abort.signal.aborted) handlers.onClose(true);
	});
	return () => abort.abort();
}
