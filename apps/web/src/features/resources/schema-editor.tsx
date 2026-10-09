import { IconPlus } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import {
	type FieldDraft,
	type FormPlace,
	fieldDraft,
} from "./resource-form-state";
import { SchemaFieldRow } from "./schema-field-row";
import {
	CELL_NAME,
	CELL_REMOVE,
	CELL_THIRD,
	CELL_TYPE,
	COMPACT_CONTROL,
	SCHEMA_ROW,
} from "./schema-grid";

export interface SchemaEditorProps {
	fields: FieldDraft[];
	onChange: (fields: FieldDraft[]) => void;
	place: FormPlace;
	/** Errors by field key. */
	errors: Record<string, string>;
}

/** Generated field shown locked above the editable ones. */
function FixedRow({
	name,
	type,
	source,
}: { name: string; type: string; source: string }) {
	const t = useT();
	return (
		<div className={SCHEMA_ROW} data-fixed="true">
			<Input
				className={cn(COMPACT_CONTROL, CELL_NAME)}
				value={name}
				disabled
				aria-label={`Field ${name}`}
			/>
			<Input
				className={cn(COMPACT_CONTROL, CELL_TYPE)}
				value={type}
				disabled
				aria-label={t("resources.schema.typeOf", { name })}
			/>
			<Input
				className={cn(COMPACT_CONTROL, CELL_THIRD)}
				value={source}
				placeholder="—"
				disabled
				aria-label={t("resources.schema.sourceOf", { name })}
			/>
			<span className={CELL_REMOVE} />
		</div>
	);
}

/**
 * Schema of a resource: the generated `id` (Object ID) and, on a nested
 * resource, `{parent}Id` (Parent ID) are locked; the other fields can be
 * renamed, retyped, removed and added.
 */
export function SchemaEditor({
	fields,
	onChange,
	place,
	errors,
}: SchemaEditorProps) {
	const t = useT();
	return (
		<div className="grid gap-2" data-id="resource-form-schema-fields">
			<div
				aria-hidden="true"
				className="hidden grid-cols-10 gap-2 font-mono font-semibold text-muted text-xs sm:grid"
			>
				<span className="col-span-3">Field</span>
				<span className="col-span-3">Type</span>
				<span className="col-span-3">Faker method / Resource</span>
			</div>
			<FixedRow name="id" type="Object ID" source="" />
			{place.parentKey ? (
				<FixedRow
					name={place.parentKey}
					type="Parent ID"
					source={place.parentName ?? ""}
				/>
			) : null}
			{fields.map((field, index) => (
				<SchemaFieldRow
					key={field.key}
					field={field}
					position={index + 1}
					place={place}
					error={errors[field.key]}
					onChange={(patch) =>
						onChange(
							fields.map((f) => (f.key === field.key ? { ...f, ...patch } : f)),
						)
					}
					onRemove={() => onChange(fields.filter((f) => f.key !== field.key))}
				/>
			))}
			<div>
				<Button
					variant="ghost"
					size="sm"
					data-id="resource-form-add-field"
					leadingIcon={<IconPlus size={16} aria-hidden="true" />}
					onClick={() => onChange([...fields, fieldDraft()])}
				>
					{t("resources.schema.addField")}
				</Button>
			</div>
		</div>
	);
}
