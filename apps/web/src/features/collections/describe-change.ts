import type { ChangelogChange } from "@localman/shared/api-client";
import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";

type FieldKey =
	`collections.changelog.fields.${keyof SourceMessages["collections"]["changelog"]["fields"]}`;

const FIELD_KEYS: ReadonlyMap<string, FieldKey> = new Map(
	Object.entries({
		name: "collections.changelog.fields.name",
		description: "collections.changelog.fields.description",
		auth: "collections.changelog.fields.auth",
		scripts: "collections.changelog.fields.scripts",
		draft: "collections.changelog.fields.draft",
		variables: "collections.changelog.fields.variables",
		tags: "collections.changelog.fields.tags",
		status: "collections.changelog.fields.status",
		order: "collections.changelog.fields.order",
		parentId: "collections.changelog.fields.parentId",
		request: "collections.changelog.fields.request",
		response: "collections.changelog.fields.response",
	} as const),
);

function fieldLabel(field: string, t: Translate): string {
	const key = FIELD_KEYS.get(field);
	return key ? t(key) : field;
}

/** One line for a change: "Renamed request List users", "Edited scripts of folder Users". */
export function describeChange(
	change: Pick<
		ChangelogChange,
		"action" | "entityKind" | "entityName" | "fields"
	>,
	t: Translate,
): string {
	const kind = t(`collections.changelog.kinds.${change.entityKind}`);
	const name = change.entityName;
	switch (change.action) {
		case "trash":
		case "untrash":
		case "restore":
			return t(`collections.changelog.describe.${change.action}`);
		case "merge":
		case "pull":
			return t(`collections.changelog.describe.${change.action}`, { name });
		case "create":
		case "move":
		case "delete":
			return t(`collections.changelog.describe.${change.action}`, {
				kind,
				name,
			});
		case "update": {
			if (change.fields.length === 1 && change.fields[0] === "name") {
				return t("collections.changelog.describe.rename", { kind, name });
			}
			const fields = [
				...new Set(change.fields.map((field) => fieldLabel(field, t))),
			];
			return t("collections.changelog.describe.update", {
				fields: fields.join(", "),
				kind,
				name,
			});
		}
	}
}
