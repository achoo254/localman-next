import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { blurEditor, editorText, setEditorText } from "../../test/code-mirror";
import { JsonEditor, type JsonEditorProps } from "./json-editor";

function Harness(props: Partial<JsonEditorProps> & { initial?: string }) {
	const [value, setValue] = useState(props.initial ?? "");
	return (
		<>
			<JsonEditor
				label="Dữ liệu"
				data-id="editor"
				{...props}
				value={value}
				onChange={(next) => {
					setValue(next);
					props.onChange?.(next);
				}}
			/>
			<output data-testid="value">{value}</output>
		</>
	);
}

const frame = () => {
	const element = document.querySelector('[data-id="editor"]');
	if (!element) throw new Error("editor not rendered");
	return element;
};

describe("JsonEditor", () => {
	it("exposes an accessible multi-line text box with the given label", () => {
		render(<Harness initial='{"a":1}' describedBy="hint" />);
		const box = screen.getByRole("textbox", { name: "Dữ liệu" });
		expect(box).toHaveAttribute("aria-multiline", "true");
		expect(box).toHaveAttribute("aria-describedby", "hint");
		expect(editorText(frame())).toBe('{"a":1}');
	});

	it("reports edits through onChange", () => {
		const onChange = vi.fn();
		render(<Harness onChange={onChange} />);
		setEditorText(frame(), "[1, 2]");
		expect(onChange).toHaveBeenLastCalledWith("[1, 2]");
		expect(screen.getByTestId("value")).toHaveTextContent("[1, 2]");
	});

	it("validates on blur and points at the syntax error", async () => {
		const onValidate = vi.fn();
		render(<Harness initial={'{\n  "a": }'} onValidate={onValidate} />);
		blurEditor(frame());
		await waitFor(() =>
			expect(onValidate).toHaveBeenLastCalledWith(
				"JSON không hợp lệ ở dòng 2, cột 8.",
			),
		);
	});

	it("runs the extra check on valid JSON and accepts empty text when allowed", async () => {
		const onValidate = vi.fn();
		const { unmount } = render(
			<Harness
				initial="[]"
				validate={(value) => (Array.isArray(value) ? "Cần object." : null)}
				onValidate={onValidate}
			/>,
		);
		blurEditor(frame());
		await waitFor(() =>
			expect(onValidate).toHaveBeenLastCalledWith("Cần object."),
		);
		unmount();

		const onEmpty = vi.fn();
		render(<Harness initial="" allowEmpty onValidate={onEmpty} />);
		blurEditor(frame());
		await waitFor(() => expect(onEmpty).toHaveBeenLastCalledWith(null));
	});

	it("marks the frame invalid and locks a disabled editor", () => {
		render(<Harness initial="{}" invalid disabled />);
		expect(frame()).toHaveAttribute("data-invalid", "true");
		expect(frame()).toHaveAttribute("data-disabled", "true");
		expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByRole("textbox")).toHaveAttribute(
			"contenteditable",
			"false",
		);
	});

	it("keeps the editor as wide as its frame and wraps lines only when asked", () => {
		const { unmount } = render(<Harness initial="{}" />);
		expect(frame()).toHaveClass("grid", "min-w-0", "grid-cols-[minmax(0,1fr)]");
		expect(frame().querySelector(".cm-content")).not.toHaveClass(
			"cm-lineWrapping",
		);
		unmount();
		render(<Harness initial="{}" lineWrapping />);
		expect(frame().querySelector(".cm-content")).toHaveClass("cm-lineWrapping");
	});
});
