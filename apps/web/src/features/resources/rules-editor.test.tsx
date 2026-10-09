import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { type RuleDraft, ruleDraft } from "./endpoint-behavior-draft";
import { RulesEditor } from "./rules-editor";

function Harness({
	initial,
	hasBody = false,
}: {
	initial: RuleDraft[];
	hasBody?: boolean;
}) {
	const [rules, setRules] = useState(initial);
	return (
		<>
			<button type="button" id="label">
				Rules for GET /users
			</button>
			<RulesEditor
				rules={rules}
				onChange={setRules}
				errors={{}}
				hasBody={hasBody}
				slug="get-list"
				id="rules"
				labelledBy="label"
			/>
		</>
	);
}

function saved(target: string, status: string): RuleDraft {
	return { ...ruleDraft(), target, value: "admin", status, open: false };
}

const toggles = () =>
	screen
		.getAllByRole("button", { name: /^Rule \d/ })
		.map((button) => button.getAttribute("aria-label"));

describe("Rules editor", () => {
	it("adds an open rule and focuses where it matches", async () => {
		render(<Harness initial={[]} />);
		expect(screen.getByText(/No rules yet/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Add rule" }));
		const source = screen.getByRole("combobox", { name: "Match on of rule 1" });
		expect(source).toHaveFocus();
		// GET requests carry no body to match.
		expect(
			within(source).queryByRole("option", { name: "Body (JSONPath)" }),
		).toBeNull();
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Condition of rule 1" }),
			"exists",
		);
		expect(
			screen.queryByRole("textbox", { name: "Value of rule 1" }),
		).toBeNull();
		await userEvent.selectOptions(source, "nth");
		expect(
			screen.queryByRole("textbox", { name: "Header name of rule 1" }),
		).toBeNull();
		const ops = screen.getByRole("combobox", { name: "Condition of rule 1" });
		expect(
			within(ops)
				.getAllByRole("option")
				.map((o) => o.textContent),
		).toEqual(["equals", "doesn't equal", "is greater than", "is less than"]);
	});

	it("offers Body on endpoints that take one", async () => {
		render(<Harness initial={[]} hasBody />);
		await userEvent.click(screen.getByRole("button", { name: "Add rule" }));
		const source = screen.getByRole("combobox", { name: "Match on of rule 1" });
		expect(
			within(source).getByRole("option", { name: "Body (JSONPath)" }),
		).toBeInTheDocument();
	});

	it("reorders with up and down, announcing the new position", async () => {
		render(
			<Harness
				initial={[saved("a", "401"), saved("b", "402"), saved("c", "403")]}
			/>,
		);
		const up = screen.getByRole("button", { name: "Move rule 1 up" });
		expect(up).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Move rule 3 down" }),
		).toBeDisabled();
		await userEvent.click(
			screen.getByRole("button", { name: "Move rule 1 down" }),
		);
		expect(toggles()).toEqual([
			'Rule 1: header b equals "admin" → 402',
			'Rule 2: header a equals "admin" → 401',
			'Rule 3: header c equals "admin" → 403',
		]);
		expect(
			screen.getByText("Rule moved to position 2 of 3."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Move rule 2 down" }),
		).toHaveFocus();
		await userEvent.click(
			screen.getByRole("button", { name: "Move rule 2 down" }),
		);
		// Now last: its down button is off, so focus moves to up.
		expect(
			screen.getByRole("button", { name: "Move rule 3 up" }),
		).toHaveFocus();
		await userEvent.click(
			screen.getByRole("button", { name: "Move rule 3 up" }),
		);
		expect(toggles()[1]).toBe('Rule 2: header a equals "admin" → 401');
	});

	it("removes a rule and moves focus to the next one", async () => {
		render(<Harness initial={[saved("a", "401"), saved("b", "402")]} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Remove rule 1" }),
		);
		expect(toggles()).toEqual(['Rule 1: header b equals "admin" → 402']);
		expect(screen.getByText("Removed rule 1.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Rule 1/ })).toHaveFocus();
		await userEvent.click(
			screen.getByRole("button", { name: "Remove rule 1" }),
		);
		expect(screen.getByRole("button", { name: "Add rule" })).toHaveFocus();
	});

	it("stops at 20 rules per endpoint", async () => {
		const many = Array.from({ length: 19 }, (_, i) => saved(`h${i}`, "200"));
		render(<Harness initial={many} />);
		await userEvent.click(screen.getByRole("button", { name: "Add rule" }));
		expect(screen.getByRole("button", { name: "Add rule" })).toBeDisabled();
		expect(
			screen.getByText("This endpoint has 20 rules, the most it can have."),
		).toBeInTheDocument();
	});

	it("expands a collapsed rule from its summary", async () => {
		render(<Harness initial={[saved("x-role", "403")]} />);
		const toggle = screen.getByRole("button", {
			name: 'Rule 1: header x-role equals "admin" → 403',
		});
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByRole("textbox", { name: "Value of rule 1" }),
		).toHaveValue("admin");
	});
});
