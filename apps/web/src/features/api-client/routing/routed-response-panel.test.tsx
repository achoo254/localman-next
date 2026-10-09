import { createRequestDraft } from "@localman/shared/api-client";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	WorkbenchProvider,
	useWorkbench,
} from "../workbench/workbench-context";
import { stubClientApi } from "../workbench/workbench-test-utils";
import type {
	RequestSender,
	SendInput,
	SettledResponse,
} from "../workbench/workbench-types";
import { RoutedResponsePanel } from "./routed-response-panel";
import { RESPONSE } from "./routed-sender-test-utils";
import { renderClient } from "./routing-test-utils";

function Harness() {
	const workbench = useWorkbench();
	const tab = workbench.activeTab;
	return (
		<>
			<button
				type="button"
				onClick={() =>
					workbench.openTab(createRequestDraft({ url: "https://api.test/" }))
				}
			>
				open
			</button>
			{tab ? (
				<>
					<button type="button" onClick={() => workbench.send(tab.id)}>
						go
					</button>
					<RoutedResponsePanel
						tabId={tab.id}
						response={tab.response}
						route={tab.draft.settings.route}
					/>
				</>
			) : null}
		</>
	);
}

/** Sender answering `answers` in turn; records each input. */
function scripted(answers: SettledResponse[]) {
	const inputs: SendInput[] = [];
	const sender: RequestSender = async (input) => {
		inputs.push(input);
		return answers[inputs.length - 1] ?? { kind: "cancelled" };
	};
	return { sender, inputs };
}

async function start(answers: SettledResponse[]) {
	stubClientApi();
	const user = userEvent.setup();
	const { sender, inputs } = scripted(answers);
	renderClient(
		<WorkbenchProvider sender={sender} saveDelayMs={10}>
			<Harness />
		</WorkbenchProvider>,
	);
	await user.click(await screen.findByRole("button", { name: "open" }));
	await user.click(screen.getByRole("button", { name: "go" }));
	return { user, inputs };
}

const failed = (
	failure: Partial<Extract<SettledResponse, { kind: "failed" }>["failure"]>,
): SettledResponse => ({
	kind: "failed",
	failure: {
		code: "X",
		message: "x",
		status: null,
		preScript: null,
		...failure,
	},
});

afterEach(() => vi.unstubAllGlobals());

describe("RoutedResponsePanel", () => {
	it("badges the route with why, and notes an automatic switch", async () => {
		await start([
			{
				kind: "done",
				result: {
					response: RESPONSE,
					route: "proxy",
					request: { method: "GET", url: "https://api.test/" },
					preScript: null,
					postScript: null,
					finishedAt: "2026-10-10T00:00:00Z",
					routing: {
						why: "cors",
						host: "api.test",
						local: false,
						forbidden: [],
						dropped: [],
					},
				},
			},
		]);
		const badge = await screen.findByText("Via proxy · CORS blocked");
		expect(badge.closest("[data-id='response-route-badge']")).toHaveTextContent(
			/sent again through the proxy/,
		);
		expect(
			screen.getByText(
				"Sent through the proxy: the browser blocked the direct send",
			),
		).toBeVisible();
	});

	it("offers the proxy after a failed direct send, for this send only", async () => {
		const { user, inputs } = await start([
			failed({
				code: "DIRECT_BLOCKED",
				routing: {
					kind: "direct",
					reason: "blocked",
					host: "api.test",
					local: false,
				},
			}),
			failed({ code: "PROXY_TIMEOUT" }),
		]);
		await user.click(
			await screen.findByRole("button", { name: "Send through proxy" }),
		);
		expect(inputs[1]?.options).toEqual({
			route: "proxy",
			afterDirectBlocked: true,
		});
		expect(inputs[1]?.draft.settings.route).toBe("auto");
	});

	it("shows the Tunelo panel for a local target and the consent step", async () => {
		const { user, inputs } = await start([
			failed({
				code: "TUNNEL_REQUIRED",
				routing: {
					kind: "tunnel",
					key: "localhost:3000",
					port: 3000,
					directFailed: false,
				},
			}),
			failed({
				code: "ROUTE_CONSENT_DECLINED",
				routing: {
					kind: "consent",
					host: "api.test",
					parts: ["Authorization"],
				},
			}),
		]);
		expect(await screen.findByText("tunelo http 3000")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Send again" }));
		const consent = await screen.findByText(
			"Not sent: needs your OK to go through the proxy",
		);
		expect(
			consent.closest("[data-id='response-route-consent']"),
		).toHaveTextContent("The request carries Authorization.");
		expect(inputs).toHaveLength(2);
	});

	it("links a used-up proxy quota to the plans", async () => {
		const { user } = await start([
			failed({ code: "MONTHLY_QUOTA_EXCEEDED", status: 429 }),
		]);
		await user.click(await screen.findByRole("button", { name: "See plans" }));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getAllByText(/proxy/i).length).toBeGreaterThan(0);
	});
});
