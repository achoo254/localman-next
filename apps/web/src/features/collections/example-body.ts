import {
	EXAMPLE_BODY_MAX,
	type ExampleResponse,
} from "@localman/shared/api-client";

const encoder = new TextEncoder();

/**
 * `text` cut to at most `max` UTF-8 bytes, on a character boundary (the
 * API counts bytes; a byte cut never leaves more characters than that).
 */
export function cutToBytes(
	text: string,
	max: number,
): { text: string; cut: boolean } {
	if (encoder.encode(text).length <= max) return { text, cut: false };
	let bytes = 0;
	let end = 0;
	for (const char of text) {
		const size = encoder.encode(char).length;
		if (bytes + size > max) break;
		bytes += size;
		end += char.length;
	}
	return { text: text.slice(0, end), cut: true };
}

/** The response with its body within `EXAMPLE_BODY_MAX`, and whether it was cut. */
export function fitExampleResponse(response: ExampleResponse): {
	response: ExampleResponse;
	cut: boolean;
} {
	const body = cutToBytes(response.body, EXAMPLE_BODY_MAX);
	return body.cut
		? { response: { ...response, body: body.text }, cut: true }
		: { response, cut: false };
}
