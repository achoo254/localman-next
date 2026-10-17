import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import { scopedCollections } from "./tenant-migration.js";
import {
	COLLECTIONS_NOT_MOVED,
	type Reseal,
	resealDocument,
} from "./tenant-move.js";

/**
 * Reading and writing a moving tenant's documents (hoandat-auth ADR 0007
 * §7): one canonical EJSON line per document, one file per collection,
 * and a manifest of counts. Raw driver calls, with `tenantId` matched and
 * set by hand: the move runs outside any request's tenant.
 */

const { EJSON } = mongoose.mongo.BSON;
const MANIFEST = "manifest.json";
const IMPORT_BATCH = 500;

export interface MovedCollection {
	readonly collection: string;
	readonly count: number;
	/** Sealed values that could not be opened: kept, still unreadable. */
	readonly unreadable: number;
}

export interface MoveManifest {
	readonly tenantId: string;
	readonly collections: readonly MovedCollection[];
}

function movedCollections(): [string, mongoose.mongo.Collection][] {
	return [...scopedCollections()]
		.filter(([name]) => !COLLECTIONS_NOT_MOVED.has(name))
		.sort(([a], [b]) => a.localeCompare(b));
}

/** Writes the tenant's documents to `dir`, sealed values sealed again. */
export async function exportTenantData(
	tenantId: string,
	dir: string,
	reseal: Reseal,
): Promise<MoveManifest> {
	const collections: MovedCollection[] = [];
	for (const [name, collection] of movedCollections()) {
		const lines: string[] = [];
		let unreadable = 0;
		for await (const doc of collection.find({ tenantId })) {
			unreadable += resealDocument(name, doc, reseal);
			lines.push(EJSON.stringify(doc, { relaxed: false }));
		}
		await writeFile(
			join(dir, `${name}.jsonl`),
			lines.map((line) => `${line}\n`).join(""),
			{
				mode: 0o600,
				flag: "wx",
			},
		);
		collections.push({ collection: name, count: lines.length, unreadable });
	}
	const manifest = { tenantId, collections };
	await writeFile(
		join(dir, MANIFEST),
		`${JSON.stringify(manifest, null, 2)}\n`,
		{
			mode: 0o600,
			flag: "wx",
		},
	);
	return manifest;
}

export async function readMoveManifest(dir: string): Promise<MoveManifest> {
	const parsed: unknown = JSON.parse(
		await readFile(join(dir, MANIFEST), "utf8"),
	);
	if (typeof parsed !== "object" || parsed === null)
		throw new Error("unreadable manifest");
	const { tenantId, collections } = parsed as Record<string, unknown>;
	if (typeof tenantId !== "string" || !Array.isArray(collections)) {
		throw new Error("unreadable manifest");
	}
	return { tenantId, collections: collections as MovedCollection[] };
}

/** Documents `tenantId` already has in the collections a move writes. */
export async function countMovedData(tenantId: string): Promise<number> {
	let total = 0;
	for (const [, collection] of movedCollections()) {
		total += await collection.countDocuments({ tenantId });
	}
	return total;
}

/**
 * Inserts the documents of `dir` for `tenantId`, sealed values sealed
 * again, and checks each collection's count against the manifest.
 */
export async function importTenantData(
	dir: string,
	tenantId: string,
	reseal: Reseal,
): Promise<MovedCollection[]> {
	const manifest = await readMoveManifest(dir);
	const known = new Map(movedCollections());
	const imported: MovedCollection[] = [];
	for (const { collection: name, count } of manifest.collections) {
		const collection = known.get(name);
		if (!collection) throw new Error(`unknown collection ${name}`);
		let batch: mongoose.mongo.Document[] = [];
		let written = 0;
		let unreadable = 0;
		const lines = createInterface({
			input: createReadStream(join(dir, `${name}.jsonl`)),
		});
		for await (const line of lines) {
			if (line.trim() === "") continue;
			const doc = EJSON.parse(line, {
				relaxed: false,
			}) as mongoose.mongo.Document;
			unreadable += resealDocument(name, doc, reseal);
			batch.push({ ...doc, tenantId });
			if (batch.length === IMPORT_BATCH) {
				written += (await collection.insertMany(batch)).insertedCount;
				batch = [];
			}
		}
		if (batch.length > 0)
			written += (await collection.insertMany(batch)).insertedCount;
		if (written !== count) {
			throw new Error(
				`${name}: ${written} documents written, the manifest says ${count}`,
			);
		}
		imported.push({ collection: name, count: written, unreadable });
	}
	return imported;
}
