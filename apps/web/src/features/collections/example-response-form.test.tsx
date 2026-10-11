import type { ExampleResponse } from "@localman/shared/api-client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExampleResponseForm } from "./example-response-form";

const response = (status: number): ExampleResponse => ({
	status,
	statusText: "",
	headers: [],
	body: "",
	bodyLanguage: "json",
});

describe("ExampleResponseForm status box", () => {
	it("follows a status stored from elsewhere unless the user is typing", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		const view = render(
			<ExampleResponseForm
				response={response(200)}
				canEdit
				onChange={onChange}
			/>,
		);
		const box = screen.getByRole("spinbutton", { name: "Status" });
		view.rerender(
			<ExampleResponseForm
				response={response(404)}
				canEdit
				onChange={onChange}
			/>,
		);
		expect(box).toHaveValue(404);
		await user.clear(box);
		await user.type(box, "5");
		view.rerender(
			<ExampleResponseForm
				response={response(201)}
				canEdit
				onChange={onChange}
			/>,
		);
		expect(box).toHaveValue(5);
		expect(screen.getByText(/100.*599/)).toBeVisible();
		await user.tab();
		view.rerender(
			<ExampleResponseForm
				response={response(500)}
				canEdit
				onChange={onChange}
			/>,
		);
		expect(box).toHaveValue(500);
		expect(screen.queryByText(/100.*599/)).toBeNull();
	});
});
