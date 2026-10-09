import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClassName } from "./button";
import { IconButton } from "./icon-button";

describe("Button", () => {
	it("renders a non-submitting button with the requested variant and size", () => {
		render(
			<Button variant="primary" size="sm">
				Lưu
			</Button>,
		);
		const button = screen.getByRole("button", { name: "Lưu" });
		expect(button).toHaveAttribute("type", "button");
		expect(button).toHaveAttribute("data-variant", "primary");
		expect(button).toHaveAttribute("data-size", "sm");
		expect(button).toHaveClass(
			"bg-primary-solid",
			"text-on-primary",
			"rounded-sm",
		);
	});

	it.each([
		["secondary", "bg-surface"],
		["ghost", "bg-transparent"],
		["danger", "bg-error"],
	] as const)("applies %s variant classes", (variant, expected) => {
		expect(buttonClassName({ variant })).toContain(expected);
	});

	it("uses 12px radius (rounded-md) and press/hover scale at default size", () => {
		const classes = buttonClassName();
		expect(classes).toContain("rounded-md");
		expect(classes).toContain("motion-safe:enabled:hover:scale-103");
		expect(classes).toContain("motion-safe:enabled:active:scale-97");
	});

	it("calls onClick when enabled", async () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Gửi</Button>);
		await userEvent.click(screen.getByRole("button", { name: "Gửi" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("does not call onClick when disabled", async () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Gửi
			</Button>,
		);
		const button = screen.getByRole("button", { name: "Gửi" });
		expect(button).toBeDisabled();
		await userEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("keeps type=submit when asked and merges custom classes", () => {
		render(
			<Button type="submit" className="mt-4" data-id="form-submit">
				OK
			</Button>,
		);
		const button = screen.getByRole("button", { name: "OK" });
		expect(button).toHaveAttribute("type", "submit");
		expect(button).toHaveClass("mt-4");
		expect(button).toHaveAttribute("data-id", "form-submit");
	});
});

describe("IconButton", () => {
	it("exposes its label as the accessible name", () => {
		render(<IconButton label="Đóng" icon={<svg aria-hidden="true" />} />);
		expect(screen.getByRole("button", { name: "Đóng" })).toHaveClass("size-9");
	});

	it("stays a 36px square: no text-button min-height or padding", () => {
		render(<IconButton label="Thêm" icon={<svg aria-hidden="true" />} />);
		const button = screen.getByRole("button", { name: "Thêm" });
		expect(button).toHaveClass(
			"size-9",
			"pointer-coarse:size-11",
			"rounded-md",
		);
		for (const cls of ["min-h-10", "px-4", "pointer-coarse:min-h-11"]) {
			expect(button).not.toHaveClass(cls);
		}
	});
});
