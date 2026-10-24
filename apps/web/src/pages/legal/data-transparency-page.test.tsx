import {
	HISTORY_MAX_ENTRIES,
	HISTORY_TTL_DAYS,
} from "@localman/shared/api-client";
import { FREE_LIMITS, PRO_LIMITS } from "@localman/shared/constants";
import {
	DATA_ITEMS,
	PROXY_LOG_FIELDS,
	REQUEST_LOG_FIELDS,
	WEB_SERVER_LOG_FIELDS,
} from "@localman/shared/data-policy";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import { renderRoutes } from "../../test/render-app";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import { DataTransparencyPage } from "./data-transparency-page";

function renderPage(flags: FeatureFlags) {
	return renderRoutes(
		[
			{
				path: "/your-data",
				element: (
					<FeaturesContext value={flags}>
						<DataTransparencyPage />
					</FeaturesContext>
				),
			},
			{ path: "/", element: <p>home</p> },
		],
		"/your-data",
	);
}

function keptOf(container: HTMLElement, id: string): string {
	const row = container.querySelector(`[data-item="${id}"]`);
	if (!(row instanceof HTMLElement)) throw new Error(`no row ${id}`);
	return (
		row.querySelector('[data-id="your-data-item-kept"]')?.textContent ?? ""
	);
}

function fieldsOf(container: HTMLElement, dataId: string): string[] {
	return [...container.querySelectorAll(`[data-id="${dataId}"] code`)].map(
		(code) => code.textContent ?? "",
	);
}

describe("the page on where your data lives", () => {
	it("lists every item of the data policy with its place", () => {
		const { container } = renderPage(ALL_FEATURES);
		expect(
			screen.getByRole("heading", { level: 1, name: "Where your data lives" }),
		).toBeInTheDocument();
		const rows = [...container.querySelectorAll('[data-id="your-data-item"]')];
		expect(rows.map((row) => row.getAttribute("data-item"))).toEqual(
			DATA_ITEMS.map((item) => item.id),
		);
		const places = rows.map((row) =>
			row.querySelector("[data-place]")?.getAttribute("data-place"),
		);
		expect(places).toEqual(DATA_ITEMS.map((item) => item.place));
		expect(screen.getByRole("link", { name: "Your data" })).toHaveAttribute(
			"href",
			"/your-data",
		);
	});

	it("states retention from the limits the server runs on", () => {
		const { container } = renderPage(ALL_FEATURES);
		expect(keptOf(container, "history")).toBe(
			`${HISTORY_TTL_DAYS} days, at most ${HISTORY_MAX_ENTRIES} entries`,
		);
		expect(keptOf(container, "mockLogs")).toBe(
			`${FREE_LIMITS.requestLogDays} days, ${PRO_LIMITS.requestLogDays} with extended limits`,
		);
		expect(keptOf(container, "vaultPassphrase")).toBe("Never sent");
		expect(keptOf(container, "proxySends")).toBe("Not stored");
	});

	it("lists exactly the fields the proxy and the server log", () => {
		const { container } = renderPage(ALL_FEATURES);
		expect(fieldsOf(container, "your-data-proxyLog")).toEqual([
			...PROXY_LOG_FIELDS,
		]);
		expect(fieldsOf(container, "your-data-serverLog")).toEqual([
			...REQUEST_LOG_FIELDS,
		]);
		expect(fieldsOf(container, "your-data-webServerLog")).toEqual([
			...WEB_SERVER_LOG_FIELDS,
		]);
		expect(
			container.querySelector('[data-id="your-data-telemetry"]'),
		).toHaveTextContent("None.");
	});

	it("words the promise honestly: the proxy asks first", () => {
		const { container } = renderPage(ALL_FEATURES);
		const promise = container.querySelector('[data-id="your-data-promise"]');
		expect(promise).toHaveTextContent("Secrets never leave the browser");
		expect(promise).toHaveTextContent("on its own, it asks you first");
		expect(promise).toHaveTextContent("a tab set to Proxy");
	});

	it("goes home while the vault is not released", async () => {
		renderPage(NO_FEATURES);
		expect(await screen.findByText("home")).toBeInTheDocument();
	});
});
