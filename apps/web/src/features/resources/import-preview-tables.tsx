import { OBJECT_ID_FIELD } from "@localman/shared/constants";
import { useId } from "react";
import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import type { ImportedField, ImportedResource } from "./resource-import-api";

const CELL = "border-border-subtle border-b px-2 py-1.5 text-left align-top";
/** Columns shown in the records preview; wider sources scroll sideways. */
const MAX_COLUMNS = 12;

/** A schema row: an imported field, or the generated `id`. */
type SchemaRow = Omit<ImportedField, "type"> & { type: string };

/** `id` first, locked like in the schema editor, unless the source has it. */
function withId(fields: readonly ImportedField[]): SchemaRow[] {
	if (fields.some((field) => field.name === OBJECT_ID_FIELD))
		return [...fields];
	const id = {
		name: OBJECT_ID_FIELD,
		type: "Object ID",
		fakerMethod: null,
		suggested: false,
	};
	return [id, ...fields];
}

function MethodCell({ field }: { field: SchemaRow }) {
	const t = useT();
	if (!field.fakerMethod) return <span aria-hidden="true">—</span>;
	return (
		<span className="inline-flex flex-wrap items-center gap-1.5">
			<code>{field.fakerMethod}</code>
			{field.suggested ? (
				<Badge tone="primary">{t("resources.schema.suggested")}</Badge>
			) : null}
		</span>
	);
}

/** Field / Type / Faker method: a table from 640px, a list below. */
export function ImportSchemaTable({
	resource,
}: { resource: ImportedResource }) {
	const t = useT();
	const fields = withId(resource.fields);
	return (
		<div data-id="resource-import-preview-schema">
			<table className="hidden w-full border-collapse font-mono text-xs sm:table">
				<caption className="sr-only">
					{t("resourceImport.preview.schema")}
				</caption>
				<thead>
					<tr className="text-muted">
						<th scope="col" className={CELL}>
							{t("resourceImport.preview.field")}
						</th>
						<th scope="col" className={CELL}>
							{t("resourceImport.preview.type")}
						</th>
						<th scope="col" className={CELL}>
							{t("resourceImport.preview.method")}
						</th>
					</tr>
				</thead>
				<tbody>
					{fields.map((field) => (
						<tr key={field.name}>
							<td className={`${CELL} font-semibold`}>{field.name}</td>
							<td className={CELL}>{field.type}</td>
							<td className={CELL}>
								<MethodCell field={field} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<dl className="m-0 grid gap-2 font-mono text-xs sm:hidden">
				{fields.map((field) => (
					<div key={field.name} className="grid gap-0.5">
						<dt className="font-semibold">{field.name}</dt>
						<dd className="m-0 text-muted">
							{field.type}
							{field.fakerMethod ? " · " : null}
							{field.fakerMethod ? <MethodCell field={field} /> : null}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

/** A record value in one short cell: objects as `{…}`, arrays as `[3]`. */
function cellText(value: unknown): string {
	if (Array.isArray(value)) return `[${value.length}]`;
	if (value !== null && typeof value === "object") return "{…}";
	return value === undefined ? "" : String(value);
}

function fullText(value: unknown): string {
	return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}

/** Up to 5 records, in a region that scrolls sideways on its own. */
export function ImportRowsTable({
	resource,
	caption,
}: { resource: ImportedResource; caption: string }) {
	const t = useT();
	const regionId = useId();
	const columns = [
		...new Set(resource.sample.flatMap((record) => Object.keys(record))),
	].slice(0, MAX_COLUMNS);
	return (
		<section
			// biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll box must be reachable by keyboard to scroll it.
			tabIndex={0}
			aria-label={t("resourceImport.preview.rowsRegion")}
			id={regionId}
			data-id="resource-import-preview-rows"
			className="overflow-x-auto rounded-md border border-border-subtle"
		>
			<table className="w-full border-collapse font-mono text-xs">
				<caption className="sr-only">{caption}</caption>
				<thead>
					<tr className="text-muted">
						{columns.map((column) => (
							<th
								key={column}
								scope="col"
								className={`${CELL} whitespace-nowrap`}
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{resource.sample.map((record, row) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: preview rows never reorder.
						<tr key={row}>
							{columns.map((column) => (
								<td key={column} className={CELL}>
									<span
										className="block max-w-48 truncate"
										title={fullText(record[column])}
									>
										{cellText(record[column])}
									</span>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
