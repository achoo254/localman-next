import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { FeaturesContext } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { downloadText } from "../../platform/download";
import { UNAUTHENTICATED, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { VnFakeDataPage } from "./vn-fake-data-page";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

const FLAGS = { ...NO_FEATURES, vnFakeData: true };

function renderTool(flags = FLAGS) {
	const api = mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
	const view = renderRoutes(
		[
			{
				path: "/tools/vn-fake-data",
				element: (
					<FeaturesContext value={flags}>
						<VnFakeDataPage />
					</FeaturesContext>
				),
			},
			{ path: "/", element: <p>Home page</p> },
		],
		"/tools/vn-fake-data",
	);
	return { ...api, ...view };
}

const table = () => screen.getByRole("table");
const bodyRows = () => within(table()).getAllByRole("row").slice(1);

describe("/tools/vn-fake-data", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(downloadText).mockReset();
	});

	it("goes home while the flag is off", async () => {
		renderTool(NO_FEATURES);
		expect(await screen.findByText("Home page")).toBeInTheDocument();
	});

	it("shows ten fake people, says they are fake and asks to sign in", async () => {
		const { calls } = renderTool();
		expect(
			screen.getByRole("heading", { level: 1, name: "Vietnamese fake data" }),
		).toBeInTheDocument();
		expect(screen.getByText("Fake data for testing only")).toBeInTheDocument();
		expect(bodyRows()).toHaveLength(10);
		expect(
			within(table()).getByRole("columnheader", { name: "CCCD" }),
		).toBeInTheDocument();
		const cta = await screen.findByRole("link", {
			name: "Sign in to create a resource",
		});
		expect(cta).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects");
		// Generated in the browser: the API is only asked who is signed in.
		expect(calls.every((call) => call.path === "/api/v1/users/me")).toBe(true);
	});

	it("follows the type and count, and keeps the rows while the count is wrong", async () => {
		renderTool();
		const user = userEvent.setup();
		await user.selectOptions(screen.getByLabelText("Data type"), "cccd");
		expect(
			within(table()).getByRole("columnheader", { name: "Province code" }),
		).toBeInTheDocument();
		const count = screen.getByLabelText("Count");
		await user.clear(count);
		await user.type(count, "3");
		expect(bodyRows()).toHaveLength(3);
		for (const row of bodyRows()) {
			expect(within(row).getAllByRole("cell")[0]?.textContent).toMatch(
				/^\d{12}$/,
			);
		}
		// One change: typing digit by digit would pass through valid counts.
		fireEvent.change(count, { target: { value: "99" } });
		expect(
			screen.getByText("Enter a whole number from 1 to 50."),
		).toBeInTheDocument();
		expect(bodyRows()).toHaveLength(3);
	});

	it("draws new data on Generate and shows it as JSON", async () => {
		renderTool();
		const user = userEvent.setup();
		const before = table().textContent;
		await user.click(screen.getByRole("button", { name: "Generate new data" }));
		expect(table().textContent).not.toBe(before);
		await user.click(screen.getByRole("button", { name: "JSON" }));
		expect(screen.getByText(/"fullName":/)).toBeInTheDocument();
	});

	it("copies JSON and downloads CSV with a BOM for spreadsheets", async () => {
		renderTool();
		const user = userEvent.setup();
		// After setup(), which installs its own clipboard.
		const writeText = vi.fn(async (_text: string) => undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		await user.click(screen.getByRole("button", { name: "Copy JSON" }));
		const copied: unknown = JSON.parse(writeText.mock.calls[0]?.[0] ?? "");
		expect(Array.isArray(copied) && copied.length).toBe(10);
		expect(
			await screen.findByText("Copied 10 records as JSON."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Download CSV" }));
		const [file, csv] = vi.mocked(downloadText).mock.calls[0] ?? [];
		expect(file).toBe("fake-person.csv");
		// Spreadsheets mangle numbers such as "0912…": the page says so.
		expect(
			screen.getByText(/drop leading zeros and the \+ of numbers/),
		).toBeInTheDocument();
		expect(csv?.startsWith("﻿fullName,gender,dateOfBirth,cccd\r\n")).toBe(true);
	});
});
