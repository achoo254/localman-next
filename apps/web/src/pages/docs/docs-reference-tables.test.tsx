import {
	DEFAULT_JSON_LIMITS,
	MOCK_QUERY_PARAMS,
} from "@localman/shared/constants";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReservedParamsNote } from "./query-params";
import { StatusCodesTable } from "./status-codes";

const number = new Intl.NumberFormat("vi-VN");

describe("docs reference tables", () => {
	it("lists every error code the mock runtime answers with", () => {
		render(<StatusCodesTable />);
		const table = screen.getByRole("table", {
			name: "Mã trạng thái và mã lỗi",
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
			`sâu hơn ${DEFAULT_JSON_LIMITS.maxDepth} tầng hoặc có hơn ${number.format(DEFAULT_JSON_LIMITS.maxNodes)} giá trị`,
		);
		expect(table).toHaveTextContent("Sai secret (đúng định dạng)");
		// Empty code cells read "Không có", not a dash.
		expect(within(table).getAllByText("Không có")).toHaveLength(2);
	});

	it("names every reserved query parameter", () => {
		render(<ReservedParamsNote />);
		for (const name of Object.values(MOCK_QUERY_PARAMS).flat()) {
			expect(screen.getByText(name, { selector: "code" })).toBeInTheDocument();
		}
	});
});
