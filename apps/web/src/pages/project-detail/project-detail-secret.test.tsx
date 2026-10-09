import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { findToast } from "../../test/toast";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

const SECRET_PATH = `/api/v1/projects/${PROJECT_ID}/rotate-secret`;
const ROTATED = makeProject(PROJECT_ID, {
	name: "Demo shop",
	prefix: "/api/v1",
	secret: "xyz789",
	mockBaseUrl: "https://xyz789.mock.localman.test/api/v1",
});

describe("changing the mock URL of a project", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("explains the effect, shows the collaborators, then shows the new URL", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${SECRET_PATH}`]: ({ query }) =>
				query.get("dryRun") === "true"
					? { body: { dryRun: true, collaborators: 2, project: ROTATED } }
					: { body: { dryRun: false, collaborators: 2, project: ROTATED } },
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Đổi URL mock" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Đổi URL mock" });
		expect(dialog).toHaveTextContent("URL cũ ngừng hoạt động ngay");
		expect(
			await within(dialog).findByText(/2 cộng tác viên sẽ nhận thông báo/),
		).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Đổi URL" }),
		);
		expect(await findToast("Đã đổi URL mock")).toBeInTheDocument();
		expect(
			screen.getByText("xyz789", { selector: "[data-id]" }),
		).toBeInTheDocument();
		const real = calls.filter(
			(call) => call.path === SECRET_PATH && !call.query.has("dryRun"),
		);
		expect(real).toHaveLength(1);
		expect(real[0]?.body).toEqual({});
	});

	it("keeps the dialog open with the error when the change fails", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${SECRET_PATH}`]: ({ query }) =>
				query.get("dryRun") === "true"
					? { body: { dryRun: true, collaborators: 0, project: ROTATED } }
					: {
							status: 500,
							body: { error: { code: "INTERNAL", message: "Lỗi máy chủ." } },
						},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Đổi URL mock" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Đổi URL mock" });
		await within(dialog).findByText("Project chưa có cộng tác viên nào.");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Đổi URL" }),
		);
		expect(await within(dialog).findByText("Lỗi máy chủ.")).toBeInTheDocument();
		expect(screen.getByText("abc123", { selector: "[data-id]" })).toBeVisible();
	});
});
