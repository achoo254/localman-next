import { screen, waitFor } from "@testing-library/react";
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
import { TuneloPanel } from "./tunelo-panel";

const MAPPING_PATH = "/api/v1/client/tunnel-mappings/localhost%3A3000";
const SETTINGS = { [`GET ${SETTINGS_PATH}`]: { body: settingsWith() } };

/** The paste form is ready once the server's tunnel domains loaded. */
async function pasteReady() {
	const submit = screen.getByRole("button", {
		name: "Replace host and send again",
	});
	await waitFor(() => expect(submit).toBeEnabled());
	return submit;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function renderPanel(onResend = vi.fn()) {
	renderClient(
		<TuneloPanel
			targetKey="localhost:3000"
			port={3000}
			directFailed
			onResend={onResend}
		/>,
	);
	return onResend;
}

describe("TuneloPanel", () => {
	it("explains why and fills the port into the tunelo command", async () => {
		stubCanvas();
		mockFetch(SETTINGS);
		renderPanel();
		const panel = screen.getByText(
			"Send to your machine through Tunelo",
		).parentElement;
		expect(
			screen.getByText("The proxy can't call localhost:3000"),
		).toBeVisible();
		expect(
			screen.getByText("Tried to send directly to localhost:3000"),
		).toBeVisible();
		expect(screen.getByText("npm install -g tunelo")).toBeVisible();
		expect(screen.getByText("tunelo login")).toBeVisible();
		expect(screen.getByText("tunelo http 3000")).toBeVisible();
		if (!panel) throw new Error("no panel");
		expect(await seriousViolations(panel)).toEqual([]);
	});

	it("refuses a URL that is not a Tunelo tunnel", async () => {
		const user = userEvent.setup();
		const { calls } = mockFetch(SETTINGS);
		const onResend = renderPanel();
		const submit = await pasteReady();
		const input = screen.getByRole("textbox", {
			name: "Or paste the tunnel URL",
		});
		await user.type(input, "https://evil.example.com");
		await user.click(submit);
		expect(input).toHaveAccessibleDescription(
			/Paste the https URL Tunelo printed/,
		);
		expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
		expect(onResend).not.toHaveBeenCalled();
	});

	it("saves the pasted tunnel as the user's mapping, then sends again", async () => {
		const user = userEvent.setup();
		const url = "https://demo.tunnel.hoandat.com";
		const { calls } = mockFetch({
			...SETTINGS,
			[`PUT ${MAPPING_PATH}`]: {
				body: settingsWith({
					tunnelMappings: [{ key: "localhost:3000", url, enabled: true }],
				}),
			},
		});
		const onResend = renderPanel();
		const submit = await pasteReady();
		await user.type(
			screen.getByRole("textbox", { name: "Or paste the tunnel URL" }),
			`${url}/ignored/path?x=1`,
		);
		await user.click(submit);
		await waitFor(() => expect(onResend).toHaveBeenCalledOnce());
		expect(calls.find((call) => call.method === "PUT")).toMatchObject({
			method: "PUT",
			path: MAPPING_PATH,
			body: { url, enabled: true },
		});
	});

	it("sends again on “Send again”", async () => {
		const user = userEvent.setup();
		mockFetch(SETTINGS);
		const onResend = renderPanel();
		await user.click(screen.getByRole("button", { name: "Send again" }));
		expect(onResend).toHaveBeenCalledOnce();
	});
});
