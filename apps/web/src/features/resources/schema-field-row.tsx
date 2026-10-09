import { FIELD_TYPES, type FieldType } from "@localman/shared/constants";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { cn } from "../../lib/cn";
import { FakerMethodSelect } from "./faker-method-select";
import {
	DEFAULT_FAKER_METHOD,
	type FieldDraft,
	type FormPlace,
} from "./resource-form-state";
import {
	CELL_NAME,
	CELL_REMOVE,
	CELL_THIRD,
	CELL_TYPE,
	COMPACT_CONTROL,
	SCHEMA_ROW,
} from "./schema-grid";

export interface SchemaFieldRowProps {
	field: FieldDraft;
	/** 1-based position, used in labels and `data-id`. */
	position: number;
	place: FormPlace;
	error: string | undefined;
	onChange: (patch: Partial<FieldDraft>) => void;
	onRemove: () => void;
}

/** Types offered here: relation types only where the tree has a relation. */
function typeOptions(place: FormPlace): FieldType[] {
	return FIELD_TYPES.filter(
		(type) =>
			(type !== "Parent Resource" || place.parentName !== null) &&
			(type !== "Child Resource" || place.children.length > 0),
	);
}

export function SchemaFieldRow({
	field,
	position,
	place,
	error,
	onChange,
	onRemove,
}: SchemaFieldRowProps) {
	const label = field.name || `field ${position}`;
	const errorId = error ? `${field.key}-error` : undefined;

	function changeType(value: string) {
		const type = FIELD_TYPES.find((candidate) => candidate === value);
		if (!type) return;
		onChange({
			type,
			fakerMethod: field.fakerMethod || DEFAULT_FAKER_METHOD,
			childId:
				type === "Child Resource"
					? field.childId || place.children[0]?.id || ""
					: field.childId,
		});
	}

	let third = (
		<Input
			className={COMPACT_CONTROL}
			value={field.type === "Parent Resource" ? (place.parentName ?? "") : ""}
			placeholder="—"
			disabled
			aria-label={`Kiểu này không cần method (${label})`}
		/>
	);
	if (field.type === "Faker.js") {
		third = (
			<FakerMethodSelect
				value={field.fakerMethod}
				onChange={(fakerMethod) => onChange({ fakerMethod })}
				label={`Faker method của ${label}`}
				invalid={Boolean(error)}
			/>
		);
	} else if (field.type === "Child Resource") {
		third = (
			<Select
				className={COMPACT_CONTROL}
				value={field.childId}
				aria-label={`Resource con của ${label}`}
				onChange={(event) => onChange({ childId: event.target.value })}
			>
				{place.children.map((child) => (
					<option key={child.id} value={child.id}>
						{child.name}
					</option>
				))}
			</Select>
		);
	}

	return (
		<div
			className="group grid gap-1"
			data-id={`resource-form-field-${position}`}
		>
			<div className={SCHEMA_ROW}>
				<Input
					className={cn(COMPACT_CONTROL, CELL_NAME)}
					value={field.name}
					placeholder="fieldName"
					autoComplete="off"
					spellCheck={false}
					aria-label={`Tên field ${position}`}
					aria-describedby={errorId}
					invalid={Boolean(error)}
					onChange={(event) => onChange({ name: event.target.value })}
				/>
				<div className={CELL_TYPE}>
					<Select
						className={COMPACT_CONTROL}
						value={field.type}
						aria-label={`Kiểu dữ liệu của ${label}`}
						onChange={(event) => changeType(event.target.value)}
					>
						{typeOptions(place).map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</Select>
				</div>
				<div className={CELL_THIRD}>{third}</div>
				<IconButton
					size="md"
					label={`Xoá field ${label}`}
					icon={<IconX size={16} aria-hidden="true" />}
					className={cn(
						CELL_REMOVE,
						"opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
					)}
					onClick={onRemove}
				/>
			</div>
			{error ? (
				<p id={errorId} className="m-0 text-error text-xs">
					{error}
				</p>
			) : null}
		</div>
	);
}
