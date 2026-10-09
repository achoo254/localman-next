import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { openMenu, renderPage } from "./projects-test-helpers";

describe("ProjectsPage", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("shows the empty state with a create button", async () => {
		renderPage({ "GET /api/v1/projects": { body: { items: [] } } });
		expect(
			await screen.findByRole("heading", { name: "No projects yet" }),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Create project" }),
		);
		expect(
			screen.getByRole("dialog", { name: "New project" }),
		).toBeInTheDocument();
	});

	it("lists owned and shared projects; shared ones cannot be edited", async () => {
		renderPage({
			"GET /api/v1/projects": {
				body: {
					items: [
						makeProject("p1", { name: "Đơn hàng", prefix: "/api" }),
						makeProject("p2", { name: "Shop", role: "collaborator" }),
					],
				},
			},
		});
		const row = await screen.findByText("Đơn hàng");
		expect(row.closest("li")).toHaveTextContent("/api");
		expect(screen.getByText("Invited")).toBeInTheDocument();
		await openMenu("Shop");
		expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
		expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
		expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
	});

	it("shows an error with retry when the list fails", async () => {
		const { calls } = renderPage({
			"GET /api/v1/projects": {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Lỗi máy chủ." } },
			},
		});
		expect(await screen.findByText("Lỗi máy chủ.")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		await waitFor(() =>
			expect(calls.filter((c) => c.path === "/api/v1/projects")).toHaveLength(
				2,
			),
		);
	});

	it("normalizes the prefix on blur and creates the project", async () => {
		const { calls } = renderPage({
			"GET /api/v1/projects": { body: { items: [] } },
			"POST /api/v1/projects": ({ body }) => ({
				status: 201,
				body: makeProject("p9", {
					name: "Demo shop",
					prefix: (body as { prefix: string }).prefix,
				}),
			}),
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Create a new project" }),
		);
		// The modal opens on the name field.
		await waitFor(() =>
			expect(screen.getByLabelText(/Project name/)).toHaveFocus(),
		);
		await userEvent.type(screen.getByLabelText(/Project name/), "Demo shop");
		const prefix = screen.getByLabelText("API Prefix");
		await userEvent.type(prefix, "api/v1/");
		await userEvent.tab();
		expect(prefix).toHaveValue("/api/v1");
		expect(screen.getByText(/\/api\/v1\/:endpoint$/)).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Create project" }),
		);
		expect(await screen.findByText("Demo shop")).toBeInTheDocument();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			name: "Demo shop",
			prefix: "/api/v1",
		});
	});

	it("rejects an invalid name and prefix before calling the API", async () => {
		const { calls } = renderPage({
			"GET /api/v1/projects": { body: { items: [] } },
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Create a new project" }),
		);
		await userEvent.type(screen.getByLabelText(/Project name/), "a/b");
		await userEvent.type(screen.getByLabelText("API Prefix"), "/xin chào");
		await userEvent.click(
			screen.getByRole("button", { name: "Create project" }),
		);
		expect(screen.getByLabelText(/Project name/)).toHaveAccessibleDescription(
			/Names can only contain/,
		);
		expect(screen.getByLabelText("API Prefix")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});

	it("edits a project", async () => {
		const { calls } = renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"PUT /api/v1/projects/p1": {
				body: makeProject("p1", { name: "Đổi tên" }),
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
		const name = screen.getByLabelText(/Project name/);
		await userEvent.clear(name);
		await userEvent.type(name, "Đổi tên");
		await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
		expect(await screen.findByText("Đổi tên")).toBeInTheDocument();
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			name: "Đổi tên",
			prefix: "",
		});
	});

	it("asks for a name that starts with a letter or digit", async () => {
		renderPage({ "GET /api/v1/projects": { body: { items: [] } } });
		await userEvent.click(
			await screen.findByRole("button", { name: "Create a new project" }),
		);
		await userEvent.type(screen.getByLabelText(/Project name/), "-shop");
		await userEvent.click(
			screen.getByRole("button", { name: "Create project" }),
		);
		expect(
			screen.getByText("Names must start with a letter or number."),
		).toBeInTheDocument();
	});
});
