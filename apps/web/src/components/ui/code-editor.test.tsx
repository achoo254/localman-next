import { language as languageFacet } from "@codemirror/language";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { editorText, editorView, setEditorText } from "../../test/code-mirror";
import { CodeEditor, type CodeEditorProps } from "./code-editor";
import type { CodeLanguage } from "./code-editor-languages";

function Harness(props: Partial<CodeEditorProps> & { initial?: string }) {
	const [value, setValue] = useState(props.initial ?? "");
	return (
		<CodeEditor
			label="Script"
			language="javascript"
			data-id="editor"
			{...props}
			value={value}
			onChange={(next) => {
				setValue(next);
				props.onChange?.(next);
			}}
		/>
	);
}

const frame = () => {
	const element = document.querySelector('[data-id="editor"]');
	if (!element) throw new Error("editor not rendered");
	return element;
};

describe("CodeEditor", () => {
	it("is a labelled multi-line text box that reports edits", () => {
		const onChange = vi.fn();
		render(<Harness initial="let a;" onChange={onChange} describedBy="hint" />);
		const box = screen.getByRole("textbox", { name: "Script" });
		expect(box).toHaveAttribute("aria-multiline", "true");
		expect(box).toHaveAttribute("aria-describedby", "hint");
		setEditorText(frame(), "let b = 2;");
		expect(onChange).toHaveBeenLastCalledWith("let b = 2;");
	});

	it("has no grammar for plain text", async () => {
		render(<Harness language="text" />);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(editorView(frame()).state.facet(languageFacet)).toBeNull();
	});

	it("follows value changes from outside and turns read-only", () => {
		const { rerender } = render(
			<CodeEditor
				label="Body"
				language="text"
				value="a"
				onChange={() => {}}
				data-id="editor"
			/>,
		);
		rerender(
			<CodeEditor
				label="Body"
				language="text"
				value="b"
				readOnly
				onChange={() => {}}
				data-id="editor"
			/>,
		);
		expect(editorText(frame())).toBe("b");
		expect(editorView(frame()).state.readOnly).toBe(true);
	});

	it.each<CodeLanguage>(["json", "javascript", "xml", "html"])(
		"loads the %s grammar on demand",
		async (language) => {
			render(<Harness language={language} initial="1" />);
			await waitFor(() =>
				expect(editorView(frame()).state.facet(languageFacet)).not.toBeNull(),
			);
		},
	);
});
