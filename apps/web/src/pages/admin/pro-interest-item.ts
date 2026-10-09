import {
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** One form submission kept in a sign-up's history (newest first). */
export interface ProInterestSubmissionEntry {
	at: string;
	userSub: string | null;
	name: string;
	needs: string[];
	teamSize: string;
	priceHint: string | null;
	note: string | null;
	source: string;
	/** The address was the signed-in account's own email. */
	emailMatchesAccount: boolean;
	/** Whether this submission updated the stored sign-up. */
	applied: boolean;
}

export interface ProInterestItem {
	id: string;
	email: string;
	name: string;
	needs: string[];
	teamSize: string;
	priceHint: string | null;
	note: string | null;
	source: string;
	createdAt: string;
	contactedAt: string | null;
	emailMatchesAccount: boolean;
	submissions: ProInterestSubmissionEntry[];
}

function strings(record: JsonRecord, key: string): string[] {
	return expectArray(record, key).filter(
		(value): value is string => typeof value === "string",
	);
}

/** Fields shared by the sign-up and each of its submissions. */
function answers(record: JsonRecord) {
	return {
		name: optionalString(record, "name") ?? "",
		needs: strings(record, "needs"),
		teamSize: optionalString(record, "teamSize") ?? "",
		priceHint: optionalString(record, "priceHint"),
		note: optionalString(record, "note"),
		source: expectString(record, "source"),
		emailMatchesAccount: record.emailMatchesAccount === true,
	};
}

function parseSubmission(value: unknown): ProInterestSubmissionEntry {
	const entry = expectRecord(value, "submission");
	return {
		at: expectString(entry, "at"),
		userSub: optionalString(entry, "userSub"),
		...answers(entry),
		applied: expectBoolean(entry, "applied"),
	};
}

export function parseItem(value: unknown): ProInterestItem {
	const item = expectRecord(value, "pro interest");
	return {
		id: expectString(item, "id"),
		email: expectString(item, "email"),
		...answers(item),
		createdAt: expectString(item, "createdAt"),
		contactedAt: optionalString(item, "contactedAt"),
		submissions: Array.isArray(item.submissions)
			? item.submissions.map(parseSubmission)
			: [],
	};
}
