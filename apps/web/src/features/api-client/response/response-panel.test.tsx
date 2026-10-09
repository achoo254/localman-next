import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../../platform/clipboard";
import { seriousViolations } from "../../../test/axe";
import { JSON_BODY, byId, done, renderPanel } from "./response-test-helpers";

vi.mock("../../../platform/clipboard", () => ({ copyText: vi.fn() }));

describe("ResponsePanel body", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => vi.restoreAllMocks());

	it("pretty-prints JSON, shows raw on demand and counts search hits", async () => {
		renderPanel(done());
		expect(byId("response-body")?.textContent).toBe(
			JSON.stringify(JSON.parse(JSON_BODY), null, 2),
		);
		expect(
			byId("response-body")?.querySelector(".text-primary"),
		).toHaveTextContent('"id"');
		await userEvent.click(screen.getByRole("button", { name: "Raw" }));
		expect(byId("response-body")?.textContent).toBe(JSON_BODY);
		await userEvent.type(screen.getByRole("searchbox"), "a");
		expect(await screen.findByText("5 matches")).toBeInTheDocument();
		expect(byId("response-body")?.querySelectorAll("mark")).toHaveLength(5);
	});

	it("previews HTML only inside a fully sandboxed frame", async () => {
		const html = "<h1>Hi</h1><script>parent.alert(1)</script>";
		renderPanel(
			done({
				headers: [{ name: "Content-Type", value: "text/html" }],
				body: html,
			}),
		);
		await userEvent.click(screen.getByRole("button", { name: "Preview" }));
		const frame = byId("response-body-preview");
		expect(frame?.tagName).toBe("IFRAME");
		expect(frame).toHaveAttribute("sandbox", "");
		expect(frame).toHaveAttribute("srcdoc", html);
	});

	it("says a binary body can't be shown and offers to save it", () => {
		renderPanel(
			done({
				headers: [{ name: "Content-Type", value: "application/octet-stream" }],
				body: "AAEC",
				bodyEncoding: "base64",
				size: 3,
			}),
		);
		expect(byId("response-body-binary")).toHaveTextContent("binary (3 B)");
		expect(byId("response-copy")).toBeDisabled();
	});

	it("warns when the body was truncated", () => {
		renderPanel(done({ truncated: true }));
		expect(byId("response-body-truncated")).toHaveTextContent("cut at 10 MB");
	});

	it("copies the body", async () => {
		vi.mocked(copyText).mockResolvedValue(true);
		renderPanel(done());
		await userEvent.click(screen.getByRole("button", { name: "Copy body" }));
		expect(copyText).toHaveBeenCalledWith(JSON_BODY);
	});

	it("has no serious accessibility violations", async () => {
		const { container } = renderPanel(done());
		await userEvent.click(byId("response-time") as HTMLElement);
		expect(byId("response-timings")).toBeVisible();
		expect(await seriousViolations(container)).toEqual([]);
	});
});
