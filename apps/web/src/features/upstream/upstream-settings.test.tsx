import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "../../lib/json-guards";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import { settingsJson } from "../request-log/request-log-test-utils";
import { BASE, renderUpstream } from "./upstream-test-utils";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("upstream settings", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("lets the owner forward to a tunnel port", async () => {
		const { calls } = renderUpstream(
			{},
			{
				[`PUT ${BASE}/upstream`]: (call) => ({
					body: settingsJson({
						upstream: isRecord(call.body) ? call.body.upstream : null,
						tunnelUrl: "https://an.tunnel.hoandat.com",
					}),
				}),
			},
		);
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("radio", { name: /^tunnel:<port>/ }),
		);
		await user.type(screen.getByLabelText("Port"), "3000");
		expect(byId("project-detail-upstream-tunnel-status")).toHaveAttribute(
			"data-state",
			"unchecked",
		);
		await user.click(screen.getByRole("button", { name: "Save upstream" }));
		await findToast("Upstream set to tunnel:3000.");
		const put = calls.find((call) => call.method === "PUT");
		expect(put?.body).toEqual({ upstream: { kind: "tunnel", port: 3000 } });
		expect(byId("project-detail-upstream-current")).toHaveTextContent(
			"In use: tunnel:3000",
		);
		const status = byId("project-detail-upstream-tunnel-status");
		expect(status).toHaveAttribute("data-state", "mapped");
		expect(status).toHaveTextContent(
			"localhost:3000 → https://an.tunnel.hoandat.com",
		);
	});

	it("suggests the Tunelo command when the port has no tunnel", async () => {
		renderUpstream({
			upstream: { kind: "tunnel", port: 4000 },
			tunnelUrl: null,
		});
		const user = userEvent.setup();
		const status = await waitFor(() => {
			const element = byId("project-detail-upstream-tunnel-status");
			if (!(element instanceof HTMLElement)) throw new Error("no status yet");
			return element;
		});
		expect(status).toHaveAttribute("data-state", "missing");
		expect(status).toHaveTextContent("Run tunelo http 4000");
		expect(
			within(status).getByRole("link", { name: "Tunelo in the API client" }),
		).toHaveAttribute("href", "/api-client");
		await user.click(
			within(status).getByRole("button", { name: "Copy command" }),
		);
		expect(await navigator.clipboard.readText()).toBe("tunelo http 4000");
		expect(
			within(status).getByRole("button", { name: "Copied" }),
		).toBeInTheDocument();
	});

	it("checks the port and the URL before saving", async () => {
		const { calls } = renderUpstream({});
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("radio", { name: /^tunnel:<port>/ }),
		);
		await user.type(screen.getByLabelText("Port"), "70000");
		await user.click(screen.getByRole("button", { name: "Save upstream" }));
		expect(
			await screen.findByText("Port must be between 1 and 65535."),
		).toBeVisible();
		await user.click(screen.getByRole("radio", { name: /^URL/ }));
		await user.type(
			screen.getByLabelText("Upstream URL"),
			"http://staging.example.com",
		);
		await user.click(screen.getByRole("button", { name: "Save upstream" }));
		expect(screen.getByLabelText("Upstream URL")).toHaveAccessibleDescription(
			"Enter a public https URL, such as https://staging.example.com.",
		);
		expect(calls.some((call) => call.method === "PUT")).toBe(false);
	});

	it("shows the private-network refusal under the URL", async () => {
		renderUpstream(
			{},
			{
				[`PUT ${BASE}/upstream`]: {
					status: 400,
					body: { error: { code: "UPSTREAM_URL_BLOCKED", message: "blocked" } },
				},
			},
		);
		const user = userEvent.setup();
		await user.click(await screen.findByRole("radio", { name: /^URL/ }));
		await user.type(screen.getByLabelText("Upstream URL"), "https://10.0.0.5");
		await user.click(screen.getByRole("button", { name: "Save upstream" }));
		expect(
			await screen.findByText(
				"This address points to a private network, so Localman can't forward to it.",
			),
		).toBeVisible();
	});

	it("is read only for collaborators", async () => {
		renderUpstream({
			canManage: false,
			upstream: { kind: "url", baseUrl: "https://staging.example.com" },
			redactHeaders: ["x-session"],
		});
		expect(
			await screen.findByText(/You're viewing as a collaborator/),
		).toBeVisible();
		for (const radio of screen.getAllByRole("radio"))
			expect(radio).toBeDisabled();
		expect(screen.getByRole("radio", { name: /^URL/ })).toBeChecked();
		expect(screen.queryByRole("button", { name: "Save upstream" })).toBeNull();
		expect(screen.queryByLabelText("Header name")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Stop masking x-session" }),
		).toBeNull();
		expect(byId("project-detail-masked-custom")).toHaveTextContent("x-session");
	});

	it("has no serious axe violations", async () => {
		const { container } = renderUpstream({
			upstream: { kind: "tunnel", port: 4000 },
		});
		await screen.findByLabelText("Port");
		expect(await seriousViolations(container)).toEqual([]);
	});
});
