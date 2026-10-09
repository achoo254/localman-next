import { vi } from "vitest";
import type {
	TurnstileCallbacks,
	TurnstileClient,
} from "../platform/turnstile";

let rendered = 0;

function renderWidget(
	_container: HTMLElement,
	_siteKey: string,
	callbacks: TurnstileCallbacks,
): string {
	callbacks.onToken("turnstile-token");
	rendered += 1;
	return `widget-${rendered}`;
}

/** Widget that solves itself at once with a fixed token. */
export const fakeTurnstile = {
	render: vi.fn(renderWidget),
	remove: vi.fn((_widgetId: string) => undefined),
} satisfies TurnstileClient;

/** Module replacement for `platform/turnstile` in `vi.mock`. */
export const turnstileModule = {
	loadTurnstile: vi.fn(async (): Promise<TurnstileClient> => fakeTurnstile),
};

export function resetFakeTurnstile(): void {
	rendered = 0;
	fakeTurnstile.render.mockClear();
	fakeTurnstile.remove.mockClear();
	turnstileModule.loadTurnstile.mockClear();
}
