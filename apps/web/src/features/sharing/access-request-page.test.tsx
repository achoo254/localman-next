import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import { AccessRequestPage } from "./access-request-page";
import {
	accessRequest,
	apiError,
	byId,
	renderSharing,
} from "./sharing-test-helpers";

const PATH = "/api/v1/access-requests/r1";

function renderRequest(routes: Record<string, MockRoute>) {
	return renderSharing(routes, {
		path: "/access-requests/:requestId",
		at: "/access-requests/r1",
		element: <AccessRequestPage />,
	});
}

describe("/access-requests/:requestId", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("shows who asks, for what and why, and approves with the role on screen", async () => {
		const { calls } = renderRequest({
			[`GET ${PATH}`]: { body: accessRequest() },
			[`POST ${PATH}/approve`]: {
				body: accessRequest({ status: "approved" }),
			},
		});
		expect(
			await screen.findByRole("heading", {
				name: "Lan asks for Viewer access",
			}),
		).toBeInTheDocument();
		expect(byId("access-request-element")).toHaveAttribute(
			"href",
			"/elements/collection/c1",
		);
		expect(byId("access-request-message")).toHaveTextContent(
			"Need it for the release",
		);
		expect(byId("access-request-status")).toHaveTextContent("Pending");
		await userEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(await findToast("Approved the request from Lan")).toBeVisible();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			role: "viewer",
		});
		expect(byId("access-request-status")).toHaveTextContent("Approved");
		expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
	});

	it("reloads when the request changed before approving", async () => {
		let upgraded = false;
		const { calls } = renderRequest({
			[`GET ${PATH}`]: () => ({
				body: accessRequest({ role: upgraded ? "editor" : "viewer" }),
			}),
			[`POST ${PATH}/approve`]: () => {
				upgraded = true;
				return apiError(409, "REQUEST_CHANGED");
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Approve" }),
		);
		expect(
			await findToast("The request changed. Check the new role and try again."),
		).toBeVisible();
		expect(
			await screen.findByRole("heading", {
				name: "Lan asks for Editor access",
			}),
		).toBeInTheDocument();
		expect(
			calls.filter((c) => c.method === "GET" && c.path === PATH),
		).toHaveLength(2);
	});

	it("denies a request", async () => {
		renderRequest({
			[`GET ${PATH}`]: { body: accessRequest() },
			[`POST ${PATH}/deny`]: { body: accessRequest({ status: "denied" }) },
		});
		await userEvent.click(await screen.findByRole("button", { name: "Deny" }));
		expect(await findToast("Declined the request from Lan")).toBeVisible();
		await waitFor(() =>
			expect(byId("access-request-status")).toHaveTextContent("Declined"),
		);
	});

	it("hides the request from people who are not its editors", async () => {
		renderRequest({ [`GET ${PATH}`]: apiError(404, "NOT_FOUND") });
		expect(
			await screen.findByRole("heading", {
				name: "This request isn't available",
			}),
		).toBeInTheDocument();
	});
});
