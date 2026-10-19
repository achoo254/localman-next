import type { CollectionDetail } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, patchAs } from "../access/testing/access-fixture.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import { setCollectionLocalValuesOperation } from "../environments/variable-scope-operations.js";
import { getCollectionChangeDiffOperation } from "./changelog-operations.js";
import { getCollectionOperation } from "./collection-read-operations.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import { updateCollectionOperation } from "./collection-write-operations.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const EARLY = "early-value-5e0a";
const SECRET = "collection-s3cret-a81f";
const LOCAL = "local-s3cret-0b3d";

/** Eve's collection: `token` public at first, then made secret. */
async function secretCollection(): Promise<string> {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(EVE, ws);
	for (const [value, secret] of [
		[EARLY, false],
		[SECRET, true],
	] as const) {
		await patchAs(EVE, `/collections/${id}`, {
			variables: [{ key: "token", value, secret }],
		}).expect(200);
	}
	return id;
}

const browserDetail = async (id: string): Promise<CollectionDetail> =>
	(await as(EVE).get(`/collections/${id}`)).body as CollectionDetail;

describe("a collection's history read by an agent", () => {
	it("blanks variables secret on either side or now, not for the browser", async () => {
		const id = await secretCollection();
		const revisions = await CollectionRevisionModel.find({ collectionId: id })
			.sort({ seq: 1 })
			.lean();
		expect(revisions.length).toBeGreaterThanOrEqual(2);
		const browser: string[] = [];
		for (const revision of revisions) {
			const revisionId = revision._id.toHexString();
			const agent = await callAsAgent(getCollectionChangeDiffOperation, EVE, {
				collectionId: id,
				revisionId,
			});
			expect(agent).toMatchObject({ available: true });
			// The value the flag protects now, even from before it was set.
			expect(JSON.stringify(agent)).not.toContain(SECRET);
			expect(JSON.stringify(agent)).not.toContain(EARLY);
			const web = await as(EVE).get(
				`/collections/${id}/changelog/${revisionId}/diff`,
			);
			browser.push(JSON.stringify(web.body));
		}
		expect(browser.join()).toContain(SECRET);
		expect(browser.join()).toContain(EARLY);
	});
});

describe("secrets written back by an agent", () => {
	it("keeps a secret sent back blank and takes a real new value", async () => {
		const id = await secretCollection();
		const read = (await callAsAgent(getCollectionOperation, EVE, {
			collectionId: id,
		})) as CollectionDetail;
		expect(read.variables).toEqual([
			expect.objectContaining({ key: "token", value: "", secret: true }),
		]);
		await callAsAgent(updateCollectionOperation, EVE, {
			collectionId: id,
			variables: [...read.variables, { key: "region", value: "eu" }],
		});
		expect((await browserDetail(id)).variables).toEqual([
			expect.objectContaining({ key: "token", value: SECRET }),
			expect.objectContaining({ key: "region", value: "eu" }),
		]);
		await callAsAgent(updateCollectionOperation, EVE, {
			collectionId: id,
			variables: [{ key: "token", value: "rotated-1", secret: true }],
		});
		expect((await browserDetail(id)).variables).toEqual([
			expect.objectContaining({ key: "token", value: "rotated-1" }),
		]);
	});

	it("blanks a secret for good when the browser sends it blank", async () => {
		const id = await secretCollection();
		await patchAs(EVE, `/collections/${id}`, {
			variables: [{ key: "token", value: "", secret: true }],
		}).expect(200);
		expect((await browserDetail(id)).variables).toEqual([
			expect.objectContaining({ key: "token", value: "" }),
		]);
	});

	it("keeps a secret's local value sent back as read", async () => {
		const id = await secretCollection();
		const path = `/collections/${id}/local-values`;
		await as(EVE)
			.send("patch", path, { values: [{ key: "token", value: LOCAL }] })
			.expect(200);
		const read = await callAsAgent(setCollectionLocalValuesOperation, EVE, {
			collectionId: id,
			values: [],
		});
		expect(read).toEqual({
			localValues: [{ key: "token", value: null, hidden: true }],
		});
		await callAsAgent(setCollectionLocalValuesOperation, EVE, {
			collectionId: id,
			values: [
				{ key: "token", value: null },
				{ key: "region", value: "eu" },
			],
		});
		const web = await as(EVE).get(path);
		expect(web.body.localValues).toEqual(
			expect.arrayContaining([
				{ key: "token", value: LOCAL },
				{ key: "region", value: "eu" },
			]),
		);
	});
});
