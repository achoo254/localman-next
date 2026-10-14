import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	apiError,
	byId,
	renderPage,
} from "../../features/public-sharing/public-sharing-test-helpers";
import { isRecord } from "../../lib/json-guards";
import { navigateToLogin } from "../../platform/navigation";
import { type MockReply, UNAUTHENTICATED } from "../../test/mock-fetch";
import { RunButtonPage } from "./run-button-page";
import { WORKSPACES, imported, preview } from "./run-test-fixtures";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

const PREVIEW = "POST /api/v1/run-buttons/preview";
const IMPORT = "POST /api/v1/run-buttons/import";

function renderRun(routes: Parameters<typeof renderPage>[0]) {
	return renderPage(routes, {
		path: "/run/:buttonId",
		at: "/run/btn_1",
		element: <RunButtonPage />,
	});
}

describe("/run/:buttonId", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("asks anonymous visitors to sign in, without loading the button", async () => {
		const { calls } = renderRun({ "GET /api/v1/users/me": UNAUTHENTICATED });
		expect(
			await screen.findByRole("heading", {
				name: "Sign in to import this collection",
			}),
		).toHaveFocus();
		expect(byId("run-sign-in-login")).toHaveAttribute(
			"href",
			expect.stringContaining(`returnTo=${encodeURIComponent("/run/btn_1")}`),
		);
		expect(calls.map((c) => c.path)).toEqual(["/api/v1/users/me"]);
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("imports once into the picked workspace and links the new collection", async () => {
		let answer: (reply: MockReply) => void = () => {};
		const { calls } = renderRun({
			"GET /api/v1/workspaces": WORKSPACES,
			[PREVIEW]: preview(),
			[IMPORT]: () =>
				new Promise<MockReply>((resolve) => {
					answer = resolve;
				}),
		});
		expect(
			await screen.findByRole("heading", { level: 1, name: "Orders API" }),
		).toBeInTheDocument();
		expect(byId("run-preview-requests")).toHaveTextContent("3 requests");
		expect(byId("run-preview-environment")).toHaveTextContent(
			"Environment: Staging",
		);
		expect(byId("run-scripts")).toHaveTextContent(
			"Orders / List orders (pre-request)",
		);
		// Viewers cannot add collections: only the Editor and Admin spaces.
		const select = await screen.findByLabelText("Import into");
		expect([...select.querySelectorAll("option")].map((o) => o.value)).toEqual([
			"w-editor",
			"w-admin",
		]);
		await userEvent.selectOptions(select, "w-admin");
		// Public button: scripts stay out unless chosen.
		expect(
			screen.getByRole("switch", { name: "Import scripts" }),
		).toHaveAttribute("aria-checked", "false");

		const submit = screen.getByRole("button", { name: "Import collection" });
		await userEvent.dblClick(submit);
		await userEvent.click(submit);
		const imports = () => calls.filter((c) => c.path.endsWith("/import"));
		await waitFor(() => expect(imports()).toHaveLength(1));
		answer(
			imported({
				code: "ENVIRONMENT_LIMIT_REACHED",
				message: "Environment limit reached",
			}),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Imported" }),
		).toHaveFocus();
		expect(
			screen.getByRole("link", { name: "Open the collection" }),
		).toHaveAttribute("href", "/elements/collection/c9");
		expect(byId("run-import-env-error")).toHaveTextContent(
			"The collection was imported, but its environment wasn't.",
		);
		expect(imports()).toHaveLength(1);
		const body = imports()[0]?.body;
		expect(body).toEqual({
			buttonId: "btn_1",
			workspaceId: "w-admin",
			includeScripts: false,
			idempotencyKey: expect.stringMatching(/^[\w-]{8,64}$/),
		});
	});

	it("keeps the same key when an import is tried again", async () => {
		let fail = true;
		const { calls } = renderRun({
			"GET /api/v1/workspaces": WORKSPACES,
			[PREVIEW]: preview({ visibility: "team" }),
			[IMPORT]: () =>
				fail ? apiError(409, "COLLECTION_LIMIT_REACHED") : imported(),
		});
		// Team button: scripts come along by default.
		expect(
			await screen.findByRole("switch", { name: "Import scripts" }),
		).toHaveAttribute("aria-checked", "true");
		await userEvent.click(
			screen.getByRole("button", { name: "Import collection" }),
		);
		expect(
			await screen.findByText(/as many collections as it can hold/),
		).toBeInTheDocument();
		fail = false;
		await userEvent.click(
			screen.getByRole("button", { name: "Import collection" }),
		);
		await screen.findByRole("heading", { level: 1, name: "Imported" });
		const keys = calls
			.filter((c) => c.path.endsWith("/import"))
			.map((c) => (isRecord(c.body) ? c.body.idempotencyKey : null));
		expect(keys).toHaveLength(2);
		expect(typeof keys[0]).toBe("string");
		expect(keys[0]).toBe(keys[1]);
	});

	it("says the button is gone on 404", async () => {
		renderRun({
			"GET /api/v1/workspaces": WORKSPACES,
			[PREVIEW]: apiError(404, "RUN_BUTTON_NOT_FOUND"),
		});
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "This Run button does not exist or was deleted.",
			}),
		).toBeInTheDocument();
	});
});
