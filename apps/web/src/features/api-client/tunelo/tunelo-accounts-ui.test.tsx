import { act, screen, waitFor } from "@testing-library/react";
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
import { PAIRING_POLL_MS } from "./use-pairing";

const LINKS = "/api/v1/client/tunnel-links";
const MACHINE = {
	id: "l1",
	deviceName: "office-pc",
	linkedAt: "2026-10-17T08:00:00.000Z",
};
const TUNNELS: LocalTunnel[] = [
	{
		protocol: "http",
		url: "https://a.tunnel.hoandat.com",
		localPort: 3000,
		deviceName: "laptop",
		basicAuth: false,
	},
	{
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

	it("shows the code and command, polls until the machine approves", async () => {
		let polls = 0;
		mockFetch({
			[`GET ${LINKS}`]: { body: { links: [] } },
			[`POST ${LINKS}`]: {
				body: {
					id: "p1",
					code: "ABCD-2345",
					expiresAt: "2026-10-17T09:00:00.000Z",
				},
			},
			[`POST ${LINKS}/p1/poll`]: () => {
				polls += 1;
				return {
					body:
						polls < 2
							? { status: "pending" }
							: { status: "linked", link: MACHINE },
				};
			},
		});
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderClient(<TunnelLinksSection />);
		await user.click(
			await screen.findByRole("button", { name: "Link a machine" }),
		);
		expect(await screen.findByText("ABCD-2345")).toBeVisible();
		expect(byDataId("tunelo-connect-command")).toHaveTextContent(
			"tunelo link ABCD-2345",
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(PAIRING_POLL_MS * 2 + 10);
		});
		await waitFor(() =>
			expect(byDataId("tunelo-connect-linked")).toBeVisible(),
		);
		expect(polls).toBe(2);
	});

	it("offers a new code once the code expired, and cancels a waiting pairing", async () => {
		const api = mockFetch({
			[`GET ${LINKS}`]: { body: { links: [] } },
			[`POST ${LINKS}`]: {
				body: {
					id: "p1",
					code: "ABCD-2345",
					expiresAt: "2026-10-17T09:00:00.000Z",
				},
			},
			[`POST ${LINKS}/p1/poll`]: { body: { status: "expired" } },
			[`DELETE ${LINKS}/p1`]: { body: { links: [] } },
		});
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderClient(<TunnelLinksSection />);
		await user.click(
			await screen.findByRole("button", { name: "Link a machine" }),
		);
		await screen.findByText("ABCD-2345");
		await act(async () => {
			await vi.advanceTimersByTimeAsync(PAIRING_POLL_MS + 10);
		});
		await waitFor(() =>
			expect(byDataId("tunelo-connect-expired")).toBeVisible(),
		);
		await user.click(screen.getByRole("button", { name: "Get a new code" }));
		await screen.findByText("ABCD-2345");
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(api.calls.some((call) => call.method === "DELETE")).toBe(true),
		);
	});
});
