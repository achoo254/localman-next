import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

describe("FormField", () => {
	it("links the label to the input", async () => {
		render(
			<FormField label="Tên project">
				<Input />
			</FormField>,
		);
		const input = screen.getByLabelText("Tên project");
		expect(input.tagName).toBe("INPUT");
		await userEvent.click(screen.getByText("Tên project"));
		expect(input).toHaveFocus();
	});

	it("describes the input with hint and shows the error", () => {
		render(
			<FormField
				label="Endpoint"
				hint="Bắt đầu bằng /"
				error="Endpoint đã tồn tại"
			>
				<Input defaultValue="/users" />
			</FormField>,
		);
		const input = screen.getByLabelText("Endpoint");
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveAccessibleDescription(
			"Bắt đầu bằng / Endpoint đã tồn tại",
		);
		// The error is read once through aria-describedby, not again as a live region.
		expect(screen.getByText("Endpoint đã tồn tại")).not.toHaveAttribute("role");
	});

	it("is valid without an error and marks required controls", () => {
		render(
			<FormField label="Email" required>
				<Input type="email" />
			</FormField>,
		);
		const input = screen.getByLabelText(/Email/);
		expect(input).not.toHaveAttribute("aria-invalid");
		expect(input).toBeRequired();
		expect(input).not.toHaveAccessibleDescription();
	});

	it("keeps explicit control ids and describedby", () => {
		render(
			<>
				<p id="extra">Thêm</p>
				<FormField label="Ghi chú" hint="Tối đa 200 ký tự">
					<Textarea id="note" aria-describedby="extra" />
				</FormField>
			</>,
		);
		const textarea = screen.getByRole("textbox");
		expect(textarea).toHaveAttribute("id", "note");
		expect(textarea).toHaveAccessibleDescription("Thêm Tối đa 200 ký tự");
	});

	it("wires native selects the same way", () => {
		render(
			<FormField label="Phương thức" error="Bắt buộc">
				<Select defaultValue="GET">
					<option value="GET">GET</option>
				</Select>
			</FormField>,
		);
		const select = screen.getByRole("combobox", { name: "Phương thức" });
		expect(select).toHaveAttribute("aria-invalid", "true");
	});
});
