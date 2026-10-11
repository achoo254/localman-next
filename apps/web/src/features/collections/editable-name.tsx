import { useEffect, useState } from "react";

export interface EditableNameProps {
	/** The name as stored (with unsaved edits). */
	name: string;
	label: string;
	readOnly: boolean;
	onRename: (name: string) => void;
	"data-id": string;
}

/**
 * The name of a page, edited in place: each non-blank change goes to
 * `onRename`; a change made elsewhere shows unless the box is being edited.
 */
export function EditableName(props: EditableNameProps) {
	const [value, setValue] = useState(props.name);
	const [editing, setEditing] = useState(false);
	useEffect(() => {
		if (!editing) setValue(props.name);
	}, [props.name, editing]);
	return (
		<input
			type="text"
			value={value}
			readOnly={props.readOnly}
			aria-label={props.label}
			data-id={props["data-id"]}
			maxLength={200}
			className="min-h-9 min-w-0 flex-1 truncate rounded-sm border border-transparent bg-transparent px-2 font-bold font-mono text-base read-only:cursor-default hover:border-border read-only:hover:border-transparent focus:border-primary focus:outline-none"
			onFocus={() => setEditing(true)}
			onBlur={() => {
				setEditing(false);
				setValue(props.name);
			}}
			onChange={(event) => {
				setValue(event.target.value);
				const next = event.target.value.trim();
				if (next) props.onRename(next);
			}}
		/>
	);
}
