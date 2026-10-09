import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { createTestQueryClient } from "../../../test/render-app";
import {
	type ClientSettings,
	DEFAULT_CLIENT_SETTINGS,
} from "./client-settings-api";

export const SETTINGS_PATH = "/api/v1/client/settings";

/** What the test server answers as its tunnel domains. */
export const TEST_TUNNEL_DOMAINS = [
	"tunnel.hoandat.com",
	"tunnel.inetdev.io.vn",
];

export function settingsWith(
	overrides: Partial<ClientSettings> = {},
): ClientSettings {
	return {
		...DEFAULT_CLIENT_SETTINGS,
		tunnelDomains: TEST_TUNNEL_DOMAINS,
		...overrides,
	};
}

/** Renders under the providers the API client panels use. */
export function renderClient(ui: ReactNode) {
	const queryClient = createTestQueryClient();
	const result = render(
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ToastProvider>{ui}</ToastProvider>
			</TooltipProvider>
		</QueryClientProvider>,
	);
	return { ...result, queryClient };
}

/** axe probes fonts through canvas, which jsdom lacks. */
export function stubCanvas(): void {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
}
