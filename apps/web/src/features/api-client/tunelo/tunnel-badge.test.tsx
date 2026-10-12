import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { mockFetch } from "../../../test/mock-fetch";
import { createTestQueryClient } from "../../../test/render-app";
import { DEFAULT_CLIENT_SETTINGS } from "../routing/client-settings-api";
import { TunnelBadge } from "./tunnel-badge";

function renderBadge(mode: "auto" | "direct" | "proxy") {
	mockFetch({
		"GET /api/v1/client/settings": {
			body: {
				...DEFAULT_CLIENT_SETTINGS,
				tunnelMappings: [
					{
						key: "localhost:8003",
						url: "https://abc.tunnel.example",
						enabled: true,
					},
				],
			},
		},
	});
	render(
		<QueryClientProvider client={createTestQueryClient()}>
			<ToastProvider>
				<TooltipProvider>
					<TunnelBadge url="http://localhost:8003/api/v1/health" mode={mode} />
				</TooltipProvider>
			</ToastProvider>
		</QueryClientProvider>,
	);
}

describe("TunnelBadge", () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		["proxy", "Via Tunelo", "Sent to https://abc.tunnel.example/api/v1/health"],
		[
			"auto",
			"Tunnel ready",
			"through https://abc.tunnel.example/api/v1/health when it cannot",
		],
		["direct", "Tunnel not used", "Choose Proxy or Auto"],
	] as const)("says what %s does with the tunnel", async (mode, label, tip) => {
		renderBadge(mode);
		const badge = await screen.findByText(label);
		expect(
			badge.closest("[data-id='request-url-tunnel-badge']"),
		).toHaveTextContent(tip);
	});
});
