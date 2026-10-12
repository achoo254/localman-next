import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import type { EnvironmentImport } from "./environment-import-note";
import { ImportModal } from "./import-modal";
import type { ImportSelection } from "./open-imported";

const COLLECTION = JSON.stringify({
	info: {
		name: "Shop",
		schema:
			"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
	},
	variable: [{ key: "baseUrl", value: "https://shop.test" }],
	auth: { type: "bearer", bearer: [{ key: "token", value: "t0k" }] },
	item: [
		{ name: "List", request: { method: "GET", url: "{{baseUrl}}/items" } },
		{
			name: "Orders",
			item: [
				{
					name: "Create",
					request: { method: "POST", url: "{{baseUrl}}/orders" },
				},
			],
		},
	],
});

function renderModal(props: { environmentImport?: EnvironmentImport } = {}) {
	const onImport = vi.fn<(selection: ImportSelection) => void>();
	const onOpenChange = vi.fn();
	render(
		<ImportModal
			open
			onOpenChange={onOpenChange}
			onImport={onImport}
			{...props}
		/>,
	);
	const dialog = screen.getByRole("dialog", { name: "Import" });
	return { dialog, onImport, onOpenChange };
}

const detection = () =>
	document.querySelector('[data-id="modal-import-detect"]');

async function paste(dialog: HTMLElement, text: string) {
	const box = within(dialog).getByRole("textbox", {
		name: "Content to import",
	});
	await userEvent.click(box);
	await userEvent.paste(text);
}

describe("ImportModal", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => vi.restoreAllMocks());

	it("detects a cURL command and opens it as one request", async () => {
		const { dialog, onImport, onOpenChange } = renderModal();
		expect(
			within(dialog).getByRole("textbox", { name: "Content to import" }),
		).toHaveFocus();
		await paste(dialog, "curl -X POST https://api.test/users -d '{\"a\":1}'");
		await waitFor(() =>
			expect(detection()).toHaveTextContent("Detected cURL: 1 request."),
		);
		// The default selection lands in an effect after detection.
		await userEvent.click(
			await within(dialog).findByRole("button", { name: "Open 1 request" }),
		);
		const selection = onImport.mock.calls[0]?.[0];
		if (selection?.kind !== "requests") throw new Error("expected requests");
		expect(selection.requests[0]?.draft).toMatchObject({
			method: "POST",
			url: "https://api.test/users",
		});
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("lets you pick requests of a collection, variables and auth filled in", async () => {
		const { dialog, onImport } = renderModal();
		await paste(dialog, COLLECTION);
		await waitFor(() =>
			expect(detection()).toHaveTextContent(
				"Detected Collection v2.1: 2 requests.",
			),
		);
		const picker = within(dialog).getByRole("group", {
			name: "Requests to open",
		});
		const boxes = within(picker).getAllByRole("checkbox");
		await waitFor(() =>
			expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([
				true,
				true,
			]),
		);
		expect(picker).toHaveTextContent("Orders / Create");
		await userEvent.click(boxes[0] as HTMLElement);
		expect(await seriousViolations(dialog)).toEqual([]);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Open 1 request" }),
		);
		const selection = onImport.mock.calls[0]?.[0];
		if (selection?.kind !== "requests") throw new Error("expected requests");
		expect(selection.requests).toHaveLength(1);
		expect(selection.requests[0]?.draft).toMatchObject({
			method: "POST",
			url: "https://shop.test/orders",
			auth: { type: "bearer", token: "t0k" },
		});
	});

	it("imports an environment file", async () => {
		const { dialog, onImport } = renderModal({ environmentImport: "allowed" });
		await paste(
			dialog,
			JSON.stringify({ name: "Dev", values: [{ key: "a", value: "1" }] }),
		);
		await waitFor(() =>
			expect(detection()).toHaveTextContent(
				"Detected an environment file: 1 variable.",
			),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Import environment" }),
		);
		expect(onImport.mock.calls[0]?.[0]).toMatchObject({
			kind: "environment",
			environment: { name: "Dev" },
			file: { name: "Dev", values: [{ key: "a", value: "1" }] },
		});
	});

	it("explains that environments can't be imported yet", async () => {
		const { dialog, onImport } = renderModal();
		await paste(
			dialog,
			JSON.stringify({ name: "Dev", values: [{ key: "a", value: "1" }] }),
		);
		expect(
			await within(dialog).findByText(
				"Environments aren't available in this workspace yet, so this file can't be imported.",
			),
		).toBeVisible();
		const submit = within(dialog).getByRole("button", {
			name: "Import environment",
		});
		expect(submit).toBeDisabled();
		await userEvent.click(submit);
		expect(onImport).not.toHaveBeenCalled();
	});

	it("tells a Viewer why they can't import an environment", async () => {
		const { dialog } = renderModal({ environmentImport: "viewer" });
		await paste(dialog, JSON.stringify({ name: "Dev", values: [] }));
		expect(
			await within(dialog).findByText(/Viewers can't add environments/),
		).toBeVisible();
		expect(
			within(dialog).getByRole("button", { name: "Import environment" }),
		).toBeDisabled();
	});

	it.each([
		["{ not json", "isn't valid JSON or a cURL command"],
		["openapi: 3.0.0\ninfo: {}", "YAML isn't supported yet"],
		['{"swagger":"2.0"}', "Swagger 2.0 isn't supported"],
		['{"hello":"world"}', "The format wasn't recognised"],
	])("explains why %j can't be imported", async (text, message) => {
		const { dialog } = renderModal();
		await paste(dialog, text);
		await waitFor(() => expect(detection()).toHaveTextContent(message));
		expect(detection()).toHaveAttribute("data-state", "error");
		expect(
			within(dialog).getByRole("button", { name: /^Open/ }),
		).toBeDisabled();
	});

	it("reads a chosen file", async () => {
		const { dialog } = renderModal();
		const input = dialog.querySelector('[data-id="modal-import-file"]');
		if (!(input instanceof HTMLInputElement)) throw new Error("file input");
		await userEvent.upload(
			input,
			new File([COLLECTION], "shop.json", { type: "application/json" }),
		);
		expect(await within(dialog).findByText(/shop\.json/)).toBeInTheDocument();
		await waitFor(() => expect(detection()).toHaveTextContent("2 requests"));
	});
});
