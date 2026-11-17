import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { mockFetch } from "../../../test/mock-fetch";
import {
	SETTINGS_PATH,
	renderClient,
	settingsWith,
	stubCanvas,
} from "../routing/routing-test-utils";
import { byDataId } from "../workbench/workbench-test-utils";
import { ChooseTunnelModal } from "./choose-tunnel-modal";
import type { LocalTunnel } from "./tunelo-accounts-api";
import { TuneloPanel } from "./tunelo-panel";
import { TunnelLinksSection } from "./tunnel-links-section";

const LINKS = "/api/v1/client/tunnel-links";
const MACHINE = {
	id: "l1",
	deviceName: "office-pc",
	linkedAt: "2026-10-17T08:00:00.000Z",
};
const TUNNELS: LocalTunnel[] = [
	{
		source: "account",
		linkId: null,
		protocol: "http",
		url: "https://a.tunnel.hoandat.com",
		localPort: 3000,
		deviceName: "laptop",
		basicAuth: false,
	},
	{
		source: "account",
		linkId: null,
		protocol: "http",
		url: "https://b.tunnel.hoandat.com",
		localPort: 3000,
		deviceName: "office-pc",
		basicAuth: true,
	},
];

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("ChooseTunnelModal", () => {
	it("answers the tunnel picked, with Basic Auth marked", async () => {
		stubCanvas();
		const onAnswer = vi.fn();
		renderClient(
			<ChooseTunnelModal
				pick={{ key: "localhost:3000", tunnels: TUNNELS }}
				onAnswer={onAnswer}
			/>,
		);
		const dialog = screen.getByRole("dialog", {
			name: "Choose a tunnel for localhost:3000",
		});
		expect(dialog).toHaveTextContent("Basic Auth");
		expect(await seriousViolations(dialog)).toEqual([]);
		await userEvent.click(screen.getByRole("button", { name: /office-pc/ }));
		expect(onAnswer).toHaveBeenCalledWith(TUNNELS[1]);
	});

	it("answers null on Cancel", async () => {
		const onAnswer = vi.fn();
		renderClient(
			<ChooseTunnelModal
				pick={{ key: "localhost:3000", tunnels: TUNNELS }}
				onAnswer={onAnswer}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onAnswer).toHaveBeenCalledWith(null);
	});
});

describe("TuneloPanel notices", () => {
	it("says the tunnel stopped, or that the port has TCP only", () => {
		mockFetch({ [`GET ${SETTINGS_PATH}`]: { body: settingsWith() } });
		const { unmount } = renderClient(
			<TuneloPanel
				targetKey="localhost:3000"
				port={3000}
				directFailed={false}
				notice="stopped"
				onResend={vi.fn()}
			/>,
		);
		expect(byDataId("tunelo-notice-stopped")).toHaveTextContent(
			"tunelo http 3000",
		);
		unmount();
		renderClient(
			<TuneloPanel
				targetKey="localhost:3000"
				port={3000}
				directFailed={false}
				notice="tcpOnly"
				onResend={vi.fn()}
			/>,
		);
		expect(byDataId("tunelo-notice-tcpOnly")).toHaveTextContent(
			"Only a TCP tunnel serves localhost:3000",
		);
	});
});

describe("Linked machines", () => {
	it("lists machines and revokes one", async () => {
		const api = mockFetch({
			[`GET ${LINKS}`]: { body: { links: [MACHINE] } },
			[`DELETE ${LINKS}/l1`]: { body: { links: [] } },
		});
		renderClient(<TunnelLinksSection />);
		expect(await screen.findByText("office-pc")).toBeVisible();
		await userEvent.click(
			screen.getByRole("button", { name: "Revoke the link of office-pc" }),
		);
		expect(await screen.findByText("No machine linked.")).toBeVisible();
		expect(api.calls.some((call) => call.method === "DELETE")).toBe(true);
	});

	it("shows how to add a machine instead of a code to type", async () => {
		const api = mockFetch({ [`GET ${LINKS}`]: { body: { links: [] } } });
		renderClient(<TunnelLinksSection />);
		expect(await screen.findByText("No machine linked.")).toBeVisible();
		const guide = byDataId("settings-tunelo-add-guide");
		expect(guide).toHaveTextContent("tunelo login");
		expect(guide).not.toHaveTextContent("tunelo link");
		expect(
			screen.getByRole("link", { name: /Open Add this machine in Chat/ }),
		).toHaveAttribute("href", "https://chat.hoandat.com/ai/add");
		expect(screen.queryByRole("button", { name: "Link a machine" })).toBeNull();
		expect(api.calls.every((call) => call.method === "GET")).toBe(true);
		expect(await seriousViolations(byDataId("settings-tunelo-links"))).toEqual(
			[],
		);
	});
});
