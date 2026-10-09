import { PRO_INTEREST_NEEDS, PRO_INTEREST_SOURCES } from "@localman/shared";
import { z } from "zod";
import { type CsvValue, toCsv } from "./csv-export.js";
import { FeedbackModel, type StoredProInterest } from "./feedback-model.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Filters shared by the list and the CSV export. */
export const proInterestFilter = z.object({
	source: z.enum(PRO_INTEREST_SOURCES).optional(),
	need: z.enum(PRO_INTEREST_NEEDS).optional(),
	contacted: z.boolean().optional(),
	/** Case-insensitive substring of the email. */
	q: z.string().trim().max(254).optional(),
});
export type ProInterestFilter = z.output<typeof proInterestFilter>;

export const proInterestItem = z.object({
	id: z.string(),
	email: z.string(),
	userSub: z.string().nullable(),
	name: z.string(),
	needs: z.array(z.enum(PRO_INTEREST_NEEDS)),
	teamSize: z.string(),
	priceHint: z.string().nullable(),
	note: z.string().nullable(),
	source: z.string(),
	consentAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	contactedAt: z.string().nullable(),
	/** The current answers come from an account that verified this email. */
	emailMatchesAccount: z.boolean(),
	/** Recent submissions, newest first; `applied: false` changed nothing. */
	submissions: z.array(
		z.object({
			at: z.string(),
			userSub: z.string().nullable(),
			name: z.string(),
			needs: z.array(z.enum(PRO_INTEREST_NEEDS)),
			teamSize: z.string(),
			priceHint: z.string().nullable(),
			note: z.string().nullable(),
			source: z.string(),
			emailMatchesAccount: z.boolean(),
			applied: z.boolean(),
		}),
	),
});
export type ProInterestItem = z.input<typeof proInterestItem>;

const escapeRegex = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function toMongoFilter(
	filter: ProInterestFilter,
): Record<string, unknown> {
	const query: Record<string, unknown> = { type: "pro_interest" };
	if (filter.source) query.source = filter.source;
	if (filter.need) query.needs = filter.need;
	if (filter.contacted !== undefined) {
		query.contactedAt = filter.contacted ? { $ne: null } : null;
	}
	if (filter.q) query.email = new RegExp(escapeRegex(filter.q.toLowerCase()));
	return query;
}

export function toProInterestItem(doc: StoredProInterest): ProInterestItem {
	return {
		id: doc._id.toHexString(),
		email: doc.email,
		userSub: doc.userSub ?? null,
		name: doc.name,
		needs: doc.needs,
		teamSize: doc.teamSize,
		priceHint: doc.priceHint ?? null,
		note: doc.note ?? null,
		source: doc.source,
		consentAt: doc.consentAt.toISOString(),
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
		contactedAt: doc.contactedAt?.toISOString() ?? null,
		emailMatchesAccount: doc.emailMatchesAccount === true,
		submissions: (doc.submissions ?? [])
			.map((submission) => ({
				at: submission.at.toISOString(),
				userSub: submission.userSub ?? null,
				name: submission.name,
				needs: submission.needs,
				teamSize: submission.teamSize,
				priceHint: submission.priceHint ?? null,
				note: submission.note ?? null,
				source: submission.source,
				emailMatchesAccount: submission.emailMatchesAccount,
				applied: submission.applied,
			}))
			.reverse(),
	};
}

export const proInterestStatsSchema = z.object({
	total: z.number().int(),
	new7d: z.number().int(),
	new30d: z.number().int(),
	bySource: z.array(z.object({ source: z.string(), count: z.number() })),
	byNeed: z.array(z.object({ need: z.string(), count: z.number() })),
});
export type ProInterestStats = z.input<typeof proInterestStatsSchema>;

interface GroupCount {
	_id: string;
	count: number;
}

async function countBy(field: "source" | "needs"): Promise<GroupCount[]> {
	return FeedbackModel.aggregate<GroupCount>([
		{ $match: { type: "pro_interest" } },
		...(field === "needs" ? [{ $unwind: "$needs" }] : []),
		{ $group: { _id: `$${field}`, count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 } },
	]);
}

/** Totals, entries of the last 7 and 30 days, counts per source and need. */
export async function proInterestStats(
	now: Date = new Date(),
): Promise<ProInterestStats> {
	const since = (days: number) => ({
		type: "pro_interest" as const,
		createdAt: { $gte: new Date(now.getTime() - days * DAY_MS) },
	});
	const [total, new7d, new30d, bySource, byNeed] = await Promise.all([
		FeedbackModel.countDocuments({ type: "pro_interest" }),
		FeedbackModel.countDocuments(since(7)),
		FeedbackModel.countDocuments(since(30)),
		countBy("source"),
		countBy("needs"),
	]);
	return {
		total,
		new7d,
		new30d,
		bySource: bySource.map((g) => ({ source: g._id, count: g.count })),
		byNeed: byNeed.map((g) => ({ need: g._id, count: g.count })),
	};
}

/** Export cap: far above the expected volume, bounds the response size. */
export const EXPORT_MAX_ROWS = 10_000;

const CSV_HEADER = [
	"email",
	"name",
	"needs",
	"teamSize",
	"priceHint",
	"note",
	"source",
	"userSub",
	"consentAt",
	"createdAt",
	"updatedAt",
	"contactedAt",
	"emailMatchesAccount",
] as const;

export async function exportProInterestCsv(
	filter: ProInterestFilter,
): Promise<string> {
	const docs = await FeedbackModel.find(toMongoFilter(filter))
		.sort({ createdAt: -1, _id: -1 })
		.limit(EXPORT_MAX_ROWS)
		.lean<StoredProInterest[]>();
	const rows = docs.map((doc): CsvValue[] => {
		const item = toProInterestItem(doc);
		return CSV_HEADER.map((key) =>
			key === "needs" ? item.needs.join(";") : item[key],
		);
	});
	return toCsv(CSV_HEADER, rows);
}
