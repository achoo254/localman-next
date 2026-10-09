import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectAvatar, avatarGroup, avatarInitial } from "./project-avatar";

describe("ProjectAvatar", () => {
	it.each([
		["Đơn hàng", "D"],
		["ứng dụng", "U"],
		["  shop", "S"],
		["123 api", "1"],
		["", "?"],
	])("uses the base letter of %j", (name, initial) => {
		expect(avatarInitial(name)).toBe(initial);
	});

	it("splits a–z into six groups of four and puts the rest in the seventh", () => {
		expect(["a", "d", "e", "h", "u", "x", "y", "z"].map(avatarGroup)).toEqual([
			0, 0, 1, 1, 5, 5, 5, 5,
		]);
		expect(avatarGroup("9 lives")).toBe(6);
		expect(avatarGroup("Ấn Độ")).toBe(avatarGroup("an do"));
	});

	it("paints the group with a viz token and on-tone text", () => {
		const { container } = render(<ProjectAvatar name="Mock shop" />);
		const avatar = container.firstElementChild;
		expect(avatar).toHaveAttribute("aria-hidden", "true");
		expect(avatar).toHaveAttribute("data-group", "4");
		expect(avatar).toHaveClass("bg-viz-green", "text-on-tone");
		expect(avatar).toHaveTextContent("M");
	});
});
