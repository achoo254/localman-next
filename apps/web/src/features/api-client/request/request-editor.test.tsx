import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	byDataId,
	echoSender,
	renderWorkbench,
	stubClientApi,
} from "../workbench/workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

async function openWith(url = "", sender = echoSender()) {
	stubClientApi([{ tabId: "t1", draft: createRequestDraft({ url }) }]);
	renderWorkbench({ sender });
	await screen.findByRole("tablist", { name: "Open requests" });
	return { sender, url: screen.getByRole("textbox", { name: "URL" }) };
}

const paramsTable = () => within(byDataId("request-params-table"));

describe("Request editor", () => {
	it("keeps the URL query and the Params table in step both ways", async () => {
		const { url } = await openWith();
		fireEvent.change(url, {
			target: { value: "https://a.test/users?page=2&q={{term}}" },
		});
		expect(
			paramsTable().getByRole("textbox", { name: "Key of row 1" }),
		).toHaveValue("page");
		expect(
			paramsTable().getByRole("textbox", { name: "Value of q" }),
		).toHaveValue("{{term}}");

		fireEvent.change(
			paramsTable().getByRole("textbox", { name: "Value of page" }),
			{
				target: { value: "3" },
			},
		);
		expect(url).toHaveValue("https://a.test/users?page=3&q={{term}}");
		const user = userEvent.setup();
		await user.click(paramsTable().getByRole("checkbox", { name: "Send q" }));
		expect(url).toHaveValue("https://a.test/users?page=3");
		await user.click(
			paramsTable().getByRole("button", { name: "Remove page" }),
		);
		expect(url).toHaveValue("https://a.test/users");
	});

	it("asks before importing a pasted cURL command into the tab", async () => {
		const { url } = await openWith("https://old.test");
		fireEvent.paste(url, {
			clipboardData: {
				getData: () =>
					"curl -X POST https://api.test/items -H 'X-Team: core' -H 'Authorization: Bearer abc' --data-raw '{\"a\":1}'",
			},
		});
		const dialog = await screen.findByRole("dialog", {
			name: "Import cURL command?",
		});
		await userEvent
			.setup()
			.click(within(dialog).getByRole("button", { name: "Import" }));
		await waitFor(() => expect(url).toHaveValue("https://api.test/items"));
		expect(byDataId("request-method")).toHaveValue("POST");
		expect(
			await screen.findByText("Imported the cURL command."),
		).toBeInTheDocument();
		fireEvent.mouseDown(byDataId("request-tab-auth"));
		expect(byDataId("auth-type")).toHaveValue("bearer");
		expect(screen.getByRole("textbox", { name: "Token" })).toHaveValue("abc");
	});

	it("keeps a pasted URL as text and shows a cURL error in the dialog", async () => {
		const { url } = await openWith();
		fireEvent.paste(url, {
			clipboardData: { getData: () => "curl 'https://unclosed" },
		});
		const dialog = await screen.findByRole("dialog");
		await userEvent
			.setup()
			.click(within(dialog).getByRole("button", { name: "Import" }));
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"A quote in the command is never closed.",
		);
	});

	it("adds the Authorization header from the Auth tab to the headers sent", async () => {
		await openWith("https://api.test/me");
		const user = userEvent.setup();
		await user.click(byDataId("request-tab-auth"));
		await user.selectOptions(byDataId("auth-type"), "basic");
		fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
			target: { value: "an" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "Password" }), {
			target: { value: "mật khẩu" },
		});
		await user.selectOptions(byDataId("auth-type"), "apikey");
		expect(screen.getByRole("textbox", { name: "Key" })).toHaveValue(
			"X-Api-Key",
		);
		await user.selectOptions(byDataId("auth-in"), "query");
		await user.selectOptions(byDataId("auth-type"), "bearer");
		fireEvent.change(screen.getByRole("textbox", { name: "Token" }), {
			target: { value: "{{token}}" },
		});

		await user.click(byDataId("request-tab-headers"));
		await user.click(byDataId("request-headers-toggle-auto"));
		const auto = document.querySelectorAll('[data-id="request-headers-auto"]');
		expect([...auto].map((row) => row.textContent)).toContain(
			"AuthorizationBearer {{token}}From the Authorization tab",
		);
	});

	it("sends with Ctrl+Enter and shows the response of the tab", async () => {
		const { url, sender } = await openWith("https://api.test/ping");
		fireEvent.keyDown(url, { key: "Enter", ctrlKey: true });
		expect(
			await screen.findByText("echo GET https://api.test/ping"),
		).toBeInTheDocument();
		expect(byDataId("response-status")).toHaveTextContent("200 OK");
		expect(sender.drafts).toHaveLength(1);
	});

	it("cancels a send in progress", async () => {
		const pending = vi.fn(
			({ signal }: { signal: AbortSignal }) =>
				new Promise<{ kind: "cancelled" }>((resolve) =>
					signal.addEventListener("abort", () =>
						resolve({ kind: "cancelled" }),
					),
				),
		);
		await openWith("https://slow.test", Object.assign(pending, { drafts: [] }));
		const user = userEvent.setup();
		await user.click(byDataId("request-send"));
		expect(byDataId("request-send")).toBeDisabled();
		await user.click(
			await screen.findByRole("button", { name: "Cancel request" }),
		);
		expect(await screen.findByText("Request cancelled.")).toBeInTheDocument();
		expect(pending.mock.calls[0]?.[0].signal.aborted).toBe(true);
	});
});
