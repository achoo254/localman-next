import { RESOURCE_NAME_MAX } from "@localman/shared/constants";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { ImportedResource } from "./resource-import-api";

export interface ImportNamesProps {
	/** The root resource first. */
	resources: readonly ImportedResource[];
	/** Edited names by resource `key`. */
	names: Readonly<Record<string, string>>;
	nameErrors: Readonly<Record<string, string>>;
	onRename: (key: string, name: string) => void;
}

/** Name of the resource to create, and of each related one ("Also creates"). */
export function ImportNames({
	resources,
	names,
	nameErrors,
	onRename,
}: ImportNamesProps) {
	const t = useT();
	const [main, ...related] = resources;
	if (!main) return null;
	return (
		<>
			<FormField
				label={t("resourceImport.nameLabel")}
				hint={renderRich(t("resources.form.nameHint"))}
				error={nameErrors[main.key]}
				data-id="resource-import-name"
			>
				<Input
					maxLength={RESOURCE_NAME_MAX}
					autoComplete="off"
					spellCheck={false}
					value={names[main.key] ?? main.name}
					onChange={(event) => onRename(main.key, event.target.value)}
				/>
			</FormField>
			{related.length > 0 ? (
				<div className="grid gap-2">
					<p className="m-0 font-mono font-semibold text-[0.8125rem]">
						{t("resourceImport.preview.alsoCreates")}
					</p>
					<ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
						{related.map((resource) => (
							<li key={resource.key} className="grid gap-1">
								<Input
									aria-label={t("resourceImport.preview.relatedName", {
										name: resource.name,
									})}
									data-id={`resource-import-related-${resource.key}`}
									className="min-h-10 text-[0.8125rem]"
									autoComplete="off"
									spellCheck={false}
									invalid={Boolean(nameErrors[resource.key])}
									value={names[resource.key] ?? resource.name}
									onChange={(event) =>
										onRename(resource.key, event.target.value)
									}
								/>
								{nameErrors[resource.key] ? (
									<span className="text-error text-xs">
										{nameErrors[resource.key]}
									</span>
								) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</>
	);
}
