import { FIELD_TYPES, type FieldType } from "@localman/shared/constants";
import { IconX } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { FakerMethodSelect } from "./faker-method-select";
import { suggestMethod } from "./faker-suggestion";
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
import { SuggestedMethodNote } from "./suggested-method-note";

export interface SchemaFieldRowProps {
	field: FieldDraft;
	/** 1-based position, used in labels and `data-id`. */
	position: number;
	place: FormPlace;
	error: string | undefined;
	onChange: (patch: Partial<FieldDraft>) => void;
	onRemove: () => void;
	/** Suggest a Faker method from the name (`mockPowerUps`). */
	suggest: boolean;
}

/** Pause in typing after which the name is matched, as on blur. */
const SUGGEST_DELAY_MS = 400;

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
	suggest,
}: SchemaFieldRowProps) {
	const t = useT();
	const label = field.name || t("resources.schema.fieldFallback", { position });
	const errorId = error ? `${field.key}-error` : undefined;
	const suggestedId = `${field.key}-suggested`;
	// The timer fires after later renders; it must see their field and callback.
	const latest = useRef({ field, onChange });
	latest.current = { field, onChange };

	function applySuggestion() {
		const patch = suggestMethod(latest.current.field);
		if (patch) latest.current.onChange(patch);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-armed by each change of the name; applySuggestion reads refs.
	useEffect(() => {
		if (!suggest) return;
		const timer = window.setTimeout(applySuggestion, SUGGEST_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [field.name, suggest]);

	function changeType(value: string) {
		const type = FIELD_TYPES.find((candidate) => candidate === value);
		if (!type) return;
		const patch = {
			type,
			fakerMethod: field.fakerMethod || DEFAULT_FAKER_METHOD,
			childId:
				type === "Child Resource"
					? field.childId || place.children[0]?.id || ""
					: field.childId,
		};
		const hint = suggest ? suggestMethod({ ...field, ...patch }) : null;
		onChange({ ...patch, ...hint });
	}

	const suggested =
		suggest && field.type === "Faker.js" && field.methodSource === "suggested";
	let third = (
		<Input
			className={COMPACT_CONTROL}
			value={field.type === "Parent Resource" ? (place.parentName ?? "") : ""}
			placeholder="—"
			disabled
			aria-label={t("resources.schema.noMethod", { label })}
		/>
	);
	if (field.type === "Faker.js") {
		third = (
			<FakerMethodSelect
				value={field.fakerMethod}
				onChange={(fakerMethod) =>
					onChange({ fakerMethod, methodSource: "user" })
				}
				label={t("resources.schema.fakerMethod", { label })}
				invalid={Boolean(error)}
				describedBy={suggested ? suggestedId : undefined}
			/>
		);
	} else if (field.type === "Child Resource") {
		third = (
			<Select
				className={COMPACT_CONTROL}
				value={field.childId}
				aria-label={t("resources.schema.childResource", { label })}
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
					aria-label={t("resources.schema.fieldName", { position })}
					aria-describedby={errorId}
					invalid={Boolean(error)}
					onChange={(event) => onChange({ name: event.target.value })}
					onBlur={suggest ? applySuggestion : undefined}
				/>
				<div className={CELL_TYPE}>
					<Select
						className={COMPACT_CONTROL}
						value={field.type}
						aria-label={t("resources.schema.dataType", { label })}
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
					label={t("resources.schema.remove", { label })}
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
			{suggested ? (
				<SuggestedMethodNote id={suggestedId} position={position} />
			) : null}
		</div>
	);
}
