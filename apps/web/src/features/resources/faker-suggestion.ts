import {
	FAKER_MATCH_CONFIDENCE,
	fakerValueKindOf,
	matchFakerField,
} from "@localman/shared/constants";
import type { FieldDraft } from "./resource-form-state";

/** Name matches at least this close fill the method in (start/end runs and up). */
const MIN_CONFIDENCE = FAKER_MATCH_CONFIDENCE.edge;

/**
 * Faker method suggested from the field name, as a patch, or `null` to
 * leave the field alone. Only Faker.js fields the user has not picked a
 * method for are touched; a saved field only once it is renamed. A name
 * that stops matching keeps the method but loses the "suggested" mark.
 */
export function suggestMethod(field: FieldDraft): Partial<FieldDraft> | null {
	if (field.type !== "Faker.js" || field.methodSource === "user") return null;
	const name = field.name.trim();
	if (name === "") return null;
	if (field.methodSource === "saved" && name === field.savedName) return null;
	const kind = fakerValueKindOf(field.type);
	const match = kind === null ? null : matchFakerField(name, kind);
	if (match && match.confidence >= MIN_CONFIDENCE) {
		const same =
			match.method === field.fakerMethod && field.methodSource === "suggested";
		return same
			? null
			: { fakerMethod: match.method, methodSource: "suggested" };
	}
	return field.methodSource === "suggested"
		? { methodSource: "default" }
		: null;
}
