import { parseArgs } from "node:util";
import type { Logger } from "../../logger.js";
import { type ActivitySource, projectActivities } from "./project-activity.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
	findProjectById,
} from "./project-model.js";
import { countDependents, deleteProjectCascade } from "./project-service.js";

export const DEFAULT_IDLE_DAYS = 90;
const MAX_IDLE_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupArgs {
	readonly idleDays: number;
	/** Delete for real; without it the run only lists (dry run). */
	readonly apply: boolean;
}

/** `[--days N] [--apply]`; throws a usage message on anything else. */
export function parseCleanupArgs(argv: readonly string[]): CleanupArgs {
	const { values } = parseArgs({
		// pnpm may forward the `--` separator itself.
		args: argv.filter((arg) => arg !== "--"),
		options: {
			days: { type: "string" },
			apply: { type: "boolean" },
		},
		strict: true,
	});
	const days = values.days ?? String(DEFAULT_IDLE_DAYS);
	const idleDays = /^\d+$/.test(days) ? Number(days) : Number.NaN;
	if (!(idleDays >= 1 && idleDays <= MAX_IDLE_DAYS)) {
		throw new Error(`--days must be a whole number from 1 to ${MAX_IDLE_DAYS}`);
	}
	return {
		idleDays,
		apply: values.apply === true,
	};
}

/** A live project without activity in the window. */
export interface AbandonedProject {
	readonly projectId: string;
	readonly owner: string;
	/** Latest of mock request, project edit and resource edit (`project-activity`). */
	readonly lastActivityAt: Date;
	readonly lastActivitySource: ActivitySource;
	/** `null`: no mock request recorded. */
	readonly lastRequestAt: Date | null;
	readonly createdAt: Date;
	readonly resources: number;
}

/**
 * Live projects whose last activity (mock request, edit of
 * the project or of one of its resources, else creation) is older than
 * `idleDays`, oldest first. Mongo narrows on the project's own dates; the
 * resource edits are checked on that shortlist.
 */
export async function findAbandonedProjects(
	idleDays: number,
	now: Date = new Date(),
): Promise<AbandonedProject[]> {
	const cutoff = new Date(now.getTime() - idleDays * DAY_MS);
	const idle = await ProjectModel.find({
		...LIVE_PROJECT,
		$and: [
			{ $or: [{ lastRequestAt: null }, { lastRequestAt: { $lt: cutoff } }] },
			{
				$or: [
					{ updatedAt: { $lt: cutoff } },
					{ updatedAt: null, createdAt: { $lt: cutoff } },
				],
			},
		],
	})
		.sort({ createdAt: 1 })
		.lean<StoredProject[]>();
	const activities = await projectActivities(idle);
	const found: AbandonedProject[] = [];
	for (const project of idle) {
		const projectId = project._id.toHexString();
		const activity = activities.get(projectId);
		if (!activity || activity.at >= cutoff) continue;
		const counts = await countDependents(project);
		found.push({
			projectId,
			owner: project.owner,
			lastActivityAt: activity.at,
			lastActivitySource: activity.source,
			lastRequestAt: project.lastRequestAt ?? null,
			createdAt: project.createdAt,
			resources: counts.find((c) => c.kind === "resources")?.count ?? 0,
		});
	}
	return found;
}

/**
 * Deletes the project through the regular cascade (tombstone, dependents,
 * document) after checking again that it is still live and idle: the
 * list may be minutes old. False when skipped.
 */
async function deleteIfStillAbandoned(
	projectId: string,
	idleDays: number,
	now: Date,
): Promise<boolean> {
	const project = await findProjectById(projectId);
	if (!project) return false;
	const activity = (await projectActivities([project])).get(projectId);
	const cutoff = now.getTime() - idleDays * DAY_MS;
	if (!activity || activity.at.getTime() >= cutoff) return false;
	await deleteProjectCascade(project);
	return true;
}

export interface CleanupSummary {
	readonly found: number;
	readonly deleted: number;
	readonly skipped: number;
	readonly failed: number;
}

/** Lists abandoned projects (one log line each) and deletes them with `apply`. */
export async function runAbandonedCleanup(
	args: CleanupArgs,
	logger: Logger,
	now: Date = new Date(),
): Promise<CleanupSummary> {
	const found = await findAbandonedProjects(args.idleDays, now);
	let deleted = 0;
	let skipped = 0;
	let failed = 0;
	for (const project of found) {
		if (!args.apply) {
			logger.info(project, "Abandoned project (dry run)");
			continue;
		}
		try {
			if (await deleteIfStillAbandoned(project.projectId, args.idleDays, now)) {
				deleted += 1;
				logger.info(project, "Deleted abandoned project");
			} else {
				skipped += 1;
				logger.info(project, "Skipped project: active again");
			}
		} catch (error) {
			failed += 1;
			logger.error(
				{ ...project, err: error },
				"Abandoned project delete failed",
			);
		}
	}
	const summary = { found: found.length, deleted, skipped, failed };
	logger.info(
		{ ...summary, idleDays: args.idleDays, apply: args.apply },
		"Abandoned project cleanup finished",
	);
	return summary;
}
