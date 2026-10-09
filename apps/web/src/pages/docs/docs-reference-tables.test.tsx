import {
	DEFAULT_JSON_LIMITS,
	MOCK_QUERY_PARAMS,
} from "@localman/shared/constants";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import { ReservedParamsNote } from "./query-params";
import { StatusCodesTable } from "./status-codes";

const number = new Intl.NumberFormat("en");

describe("docs reference tables", () => {
	it("lists every error code the mock runtime answers with", () => {
		render(<StatusCodesTable />);
		const table = screen.getByRole("table", {
			name: "Status codes and error codes",
		});
		for (const code of [
			"INVALID_QUERY",
			"INVALID_JSON",
			"VALIDATION_ERROR",
			"BAD_REQUEST",
			'"Not found"',
			"NOT_FOUND",
			"UNSUPPORTED_MEDIA_TYPE",
			"PAYLOAD_TOO_LARGE",
			"RATE_LIMITED",
		]) {
			expect(within(table).getAllByText(code).length).toBeGreaterThan(0);
		}
		expect(table).toHaveTextContent(
			`deeper than ${DEFAULT_JSON_LIMITS.maxDepth} levels or holding more than ${number.format(DEFAULT_JSON_LIMITS.maxNodes)} values`,
		);
		expect(table).toHaveTextContent("Wrong secret (well-formed)");
		// Empty code cells read "None", not a dash.
		expect(within(table).getAllByText("None")).toHaveLength(2);
	});

	it("lists the chaos errors only once chaos is released", () => {
		const { unmount } = render(
			<FeaturesContext value={NO_FEATURES}>
				<StatusCodesTable />
			</FeaturesContext>,
		);
		expect(screen.queryByText("MOCK_CHAOS_ERROR")).toBeNull();
		unmount();
		render(
			<FeaturesContext value={ALL_FEATURES}>
				<StatusCodesTable />
			</FeaturesContext>,
		);
		expect(screen.getByText("MOCK_CHAOS_ERROR")).toBeInTheDocument();
		const timeout = screen.getByText("MOCK_TIMEOUT").closest("tr");
		expect(timeout).toHaveTextContent(/^504/);
		const cancelled = screen.getByText("REQUEST_CANCELLED").closest("tr");
		expect(cancelled).toHaveTextContent(/^499.*Mock MCP only/);
	});

	it("names every reserved query parameter", () => {
		render(<ReservedParamsNote />);
		for (const name of Object.values(MOCK_QUERY_PARAMS).flat()) {
			expect(screen.getByText(name, { selector: "code" })).toBeInTheDocument();
		}
	});
});
