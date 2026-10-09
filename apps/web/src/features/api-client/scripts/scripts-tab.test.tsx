import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editorText, setEditorText } from "../../../test/code-mirror";
import {
	byDataId,
	echoSender,
	renderWorkbench,
	stubClientApi,
} from "../workbench/workbench-test-utils";
import { appendSnippet } from "./script-snippets";

afterEach(() => vi.unstubAllGlobals());

async function open() {
	const sender = echoSender();
	stubClientApi([
		{ tabId: "t1", draft: createRequestDraft({ url: "https://a.test" }) },
	]);
	renderWorkbench({ sender });
	await screen.findByRole("tablist", { name: "Open requests" });
	return { sender, user: userEvent.setup() };
}

describe("Scripts and settings panes", () => {
	it("edits pre and post scripts apart and inserts snippets", async () => {
		const { user, sender } = await open();
		await user.click(byDataId("request-tab-scripts"));
		setEditorText(byDataId("request-scripts-editor"), "const a = 1;");
		await user.click(
			screen.getByRole("button", { name: "Test status is 200" }),
		);
		expect(editorText(byDataId("request-scripts-editor"))).toContain(
			'const a = 1;\nlm.test("Status is 200"',
		);
		await user.click(byDataId("request-scripts-post"));
		expect(byDataId("request-scripts-post")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(editorText(byDataId("request-scripts-editor"))).toBe("");
		await user.click(
			screen.getByRole("button", { name: "Log the request URL" }),
		);
		await user.click(byDataId("request-send"));
		await screen.findByText(/^echo GET/);
		expect(sender.drafts[0]?.scripts).toEqual({
			pre: expect.stringContaining("const a = 1;"),
			post: "console.log(lm.request.url);\n",
		});
	});

	it("appends snippets on a new line", () => {
		expect(appendSnippet("", "x();")).toBe("x();\n");
		expect(appendSnippet("a();", "x();")).toBe("a();\nx();\n");
		expect(appendSnippet("a();\n", "x();")).toBe("a();\nx();\n");
	});

	it("toggles per-request settings and clamps the timeout", async () => {
		const { user, sender } = await open();
		await user.click(byDataId("request-tab-settings"));
		await user.click(screen.getByRole("switch", { name: "Send client IP" }));
		await user.click(screen.getByRole("switch", { name: "Follow redirects" }));
		const timeout = screen.getByRole("spinbutton", { name: "Timeout (ms)" });
		fireEvent.change(timeout, { target: { value: "999999" } });
		fireEvent.blur(timeout);
		expect(timeout).toHaveValue(120000);
		await user.selectOptions(byDataId("request-route"), "proxy");
		await user.click(byDataId("request-send"));
		await screen.findByText(/^echo GET/);
		expect(sender.drafts[0]?.settings).toEqual({
			followRedirects: false,
			sendClientIp: false,
			timeoutMs: 120000,
			route: "proxy",
		});
	});
});
