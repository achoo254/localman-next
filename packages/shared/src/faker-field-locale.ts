/**
 * Whether a field's name is Vietnamese (`ho_ten`, `sdt`, `diaChi`), so
 * its Faker values come from the `vi` locale instead of English. Faker-
 * free: names are split like the field matcher does.
 */
import { VIETNAMESE_FIELD_WORDS } from "./faker-field-rules.js";
import { fieldNameTokens, nameRuns } from "./faker-name-runs.js";

const VIETNAMESE_WORD = new RegExp(`^(?:${VIETNAMESE_FIELD_WORDS})$`);

export function isVietnameseFieldName(name: string): boolean {
	return (
		nameRuns(fieldNameTokens(name), (run) => VIETNAMESE_WORD.test(run)).length >
		0
	);
}
