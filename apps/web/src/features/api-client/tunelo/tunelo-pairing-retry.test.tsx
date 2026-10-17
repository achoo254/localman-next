import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MockRoute, mockFetch } from "../../../test/mock-fetch";
import { renderClient } from "../routing/routing-test-utils";
import { byDataId } from "../workbench/workbench-test-utils";
import { TunnelLinksSection } from "./tunnel-links-section";
import { PAIRING_POLL_MS } from "./use-pairing";

const LINKS = "/api/v1/client/tunnel-links";
const MACHINE = {
	id: "l1",
	deviceName: "office-pc",
	linkedAt: "2026-10-17T08:00:00.000Z",
	revoked: false,
};
const PAIRING = {
	id: "p1",
	code: "ABCD-2345",
	expiresAt: "2026-10-17T09:00:00.000Z",
};

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** Opens the connect modal with `poll` answering the pairing's polls. */
async function openPairing(poll: MockRoute) {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
	mockFetch({
		[`GET ${LINKS}`]: { body: { links: [] } },
		[`POST ${LINKS}`]: { body: PAIRING },
		[`POST ${LINKS}/p1/poll`]: poll,
		[`DELETE ${LINKS}/p1`]: { body: { links: [] } },
	});
	renderClient(<TunnelLinksSection />);
	await user.click(
		await screen.findByRole("button", { name: "Link a machine" }),
	);
	await screen.findByText(PAIRING.code);
}

async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

describe("pairing poll", () => {
	it("retries a passing server error, then shows the linked machine", async () => {
		let polls = 0;
		await openPairing(() => {
			polls += 1;
			return polls === 1
				? { status: 502, body: { error: { code: "TUNELO_UNAVAILABLE" } } }
				: { body: { status: "linked", link: MACHINE } };
		});
		await advance(PAIRING_POLL_MS + 10);
		expect(byDataId("tunelo-connect-waiting")).toBeVisible();
		await advance(PAIRING_POLL_MS * 2 + 10);
		await waitFor(() =>
			expect(byDataId("tunelo-connect-linked")).toBeVisible(),
		);
		expect(polls).toBe(2);
	});

	it("reads a pairing the server no longer has as expired", async () => {
		await openPairing({
			status: 404,
			body: { error: { code: "NOT_FOUND", message: "Tunnel link not found" } },
		});
		await advance(PAIRING_POLL_MS + 10);
		await waitFor(() =>
			expect(byDataId("tunelo-connect-expired")).toBeVisible(),
		);
	});
});

describe("linked machines", () => {
	it("marks a machine whose link was revoked on the machine", async () => {
		mockFetch({
			[`GET ${LINKS}`]: { body: { links: [{ ...MACHINE, revoked: true }] } },
		});
		renderClient(<TunnelLinksSection />);
		expect(await screen.findByText(/Revoked on the machine/)).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Revoke the link of office-pc" }),
		).toBeEnabled();
	});
});
