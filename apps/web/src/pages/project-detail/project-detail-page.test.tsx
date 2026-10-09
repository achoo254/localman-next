import {
	act,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { openExternal } from "../../platform/navigation";
import { makeProject } from "../../test/fixtures";
import type { MockReply } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import {
	RESOURCES_PATH,
	apiError,
	bar,
	change,
	findNode,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";
import { EMPTY_PROMPT_DELAY_MS } from "./use-first-resource-prompt";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	openExternal: vi.fn(),
}));

describe("ProjectDetailPage", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(openExternal).mockClear();
	});

	it("shows the coloured mock URL with an explanation for each part", async () => {
		renderDetail({ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } });
		expect(
			await screen.findByRole("heading", { level: 1, name: "Demo shop" }),
		).toBeInTheDocument();
		const url = screen.getByText(":endpoint").closest("p");
		expect(url).toHaveTextContent(
			"https://abc123.mock.localman.test/api/v1/:endpoint",
		);
		// Breadcrumb link, Cộng tác viên, Magic link, then the secret chip.
		await userEvent.tab();
		await userEvent.tab();
		await userEvent.tab();
		await userEvent.tab();
		expect(screen.getByText("abc123")).toHaveFocus();
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			/Mã bí mật của project/,
		);
		expect(screen.getByRole("button", { name: "Sinh tất cả" })).toBeEnabled();
	});

	it("lays the tree out with links to the mock endpoints", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const posts = await findNode("posts");
		const link = within(posts).getByRole("link", { name: "posts" });
		expect(link).toHaveAttribute(
			"href",
			"https://abc123.mock.localman.test/api/v1/posts",
		);
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		await userEvent.click(link);
		expect(openExternal).toHaveBeenCalledWith(
			"https://abc123.mock.localman.test/api/v1/posts",
		);
		expect(posts.style.left).toBe("340px");
		expect(screen.getByText("4 resource")).toBeInTheDocument();
	});

	it("opens New resource 500ms after an empty project loads", async () => {
		renderDetail({ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } });
		await screen.findByText(/Chưa có resource nào/);
		const shownAt = Date.now();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			await screen.findByRole(
				"dialog",
				{ name: "Resource mới" },
				{ timeout: 3000 },
			),
		).toBeInTheDocument();
		expect(Date.now() - shownAt).toBeGreaterThanOrEqual(
			EMPTY_PROMPT_DELAY_MS - 50,
		);
	});

	it("reads the project from GET /projects/:id and says so when it is gone", async () => {
		const { calls } = renderDetail({}, makeProject("other"));
		expect(
			await screen.findByRole("heading", { name: "Không tìm thấy project" }),
		).toBeInTheDocument();
		expect(calls.map((c) => c.path)).toContain("/api/v1/projects/p1");
		expect(calls.map((c) => c.path)).not.toContain("/api/v1/projects");
	});

	it("offers a retry when the project cannot be loaded", async () => {
		renderDetail({ "GET /api/v1/projects/p1": apiError(500, "INTERNAL") });
		expect(
			await screen.findByText("Không tải được project"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
	});
});

describe("generating from the canvas", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	function holdGenerate() {
		let answer: (reply: MockReply) => void = () => {};
		const pending = new Promise<MockReply>((resolve) => {
			answer = resolve;
		});
		return {
			route: () => pending,
			answer: (reply: MockReply) => answer(reply),
		};
	}

	it("shows the new count at once and keeps it when the API agrees", async () => {
		const generate = holdGenerate();
		const items = sampleTree();
		const { calls } = renderDetail({
			// Stateful: the list refetched after the write sees the new count.
			[`GET ${RESOURCES_PATH}`]: () => ({ body: { items } }),
			[`POST ${RESOURCES_PATH}/likes/generate`]: generate.route,
		});
		const slider = bar(await findNode("likes"));
		slider.getBoundingClientRect = () => new DOMRect(0, 0, 106, 25);
		fireEvent.click(slider, { clientX: 53 });
		// Optimistic: the bar moves while the API has not answered yet.
		await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "50"));
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({ count: 50 });
		items[3] = { ...items[3], id: "likes", name: "likes", count: 50 };
		generate.answer({
			body: { dryRun: false, changes: [change("likes", 0, 50)] },
		});
		expect(await screen.findByText("Đã sinh dữ liệu")).toBeInTheDocument();
		expect(await findToast("50 bản ghi cho likes.")).toBeInTheDocument();
		expect(slider).toHaveAttribute("aria-valuenow", "50");
	});

	it("rolls the count back and explains when the API refuses", async () => {
		const generate = holdGenerate();
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}/users/generate`]: generate.route,
		});
		const slider = bar(await findNode("users"));
		act(() => slider.focus());
		await userEvent.keyboard("{ArrowRight}{Enter}");
		await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "20"));
		generate.answer(
			apiError(413, "DATA_TOO_LARGE", { limit: "resource", name: "users" }),
		);
		expect(
			await screen.findByText(
				"Dữ liệu của users vượt 2 MB. Hãy giảm số bản ghi hoặc kích thước mỗi bản ghi.",
			),
		).toBeInTheDocument();
		await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "10"));
	});

	it("blocks a child until its parent has data", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const slider = bar(await findNode("comments"));
		expect(slider).toHaveAttribute("aria-disabled", "true");
		fireEvent.click(slider, { clientX: 10 });
		expect(
			await screen.findByText(
				"Cần sinh dữ liệu cho posts trước khi sinh cho comments.",
			),
		).toBeInTheDocument();
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});
});
