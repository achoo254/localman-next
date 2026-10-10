import { act } from "@testing-library/react";
import { vi } from "vitest";

type Listener = (event: Event) => void;

/** `EventSource` stand-in: tests open, feed and break the stream. */
export class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	static instances: FakeEventSource[] = [];

	readonly url: string;
	readonly withCredentials: boolean;
	readyState = FakeEventSource.CONNECTING;
	onopen: Listener | null = null;
	onerror: Listener | null = null;
	private readonly listeners = new Map<string, Set<Listener>>();

	constructor(url: string | URL, init?: EventSourceInit) {
		this.url = String(url);
		this.withCredentials = init?.withCredentials ?? false;
		FakeEventSource.instances.push(this);
	}

	addEventListener(type: string, listener: Listener): void {
		const set = this.listeners.get(type) ?? new Set<Listener>();
		set.add(listener);
		this.listeners.set(type, set);
	}

	removeEventListener(type: string, listener: Listener): void {
		this.listeners.get(type)?.delete(listener);
	}

	close(): void {
		this.readyState = FakeEventSource.CLOSED;
	}

	/** The server accepted the stream. */
	open(): void {
		act(() => {
			this.readyState = FakeEventSource.OPEN;
			this.onopen?.(new Event("open"));
		});
	}

	/** One `event: log` with `data` as JSON. */
	emit(data: unknown): void {
		const event = new MessageEvent("log", { data: JSON.stringify(data) });
		act(() => {
			for (const listener of this.listeners.get("log") ?? []) listener(event);
		});
	}

	/** Connection lost; `closed` when the browser gave up (refused stream). */
	fail(closed = false): void {
		act(() => {
			this.readyState = closed
				? FakeEventSource.CLOSED
				: FakeEventSource.CONNECTING;
			this.onerror?.(new Event("error"));
		});
	}

	/** Streams not closed yet. */
	static open(): FakeEventSource[] {
		return FakeEventSource.instances.filter(
			(source) => source.readyState !== FakeEventSource.CLOSED,
		);
	}

	static latest(): FakeEventSource {
		const source = FakeEventSource.instances.at(-1);
		if (!source) throw new Error("no EventSource was created");
		return source;
	}
}

export function stubEventSource(): void {
	FakeEventSource.instances = [];
	vi.stubGlobal("EventSource", FakeEventSource);
}
