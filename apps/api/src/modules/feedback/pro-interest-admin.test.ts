import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	guest,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { FeedbackModel } from "./feedback-model.js";

const OWNER = "acc_owner";
const USER = "acc_user";
const DAY_MS = 24 * 60 * 60 * 1000;

useDashboardTestDb(() => ({ ownerSubs: new Set([OWNER]) }));

async function seed(): Promise<string[]> {
	const now = Date.now();
	const entries = [
		{
			email: "a@x.com",
			needs: ["mock", "team"],
			source: "landing",
			ageDays: 1,
		},
		{ email: "b@x.com", needs: ["mock"], source: "landing", ageDays: 10 },
		{
			email: "=cmd@evil.com",
			needs: ["mcp"],
			source: "plan_limit_projects",
			ageDays: 40,
		},
	];
	const docs = await FeedbackModel.insertMany(
		entries.map((entry) => ({
			type: "pro_interest",
			email: entry.email,
			name: entry.email.startsWith("=")
				? '=HYPERLINK("http://evil")'
				: 'Tên, "quoted"',
			needs: entry.needs,
			teamSize: "1",
			note: "+SUM(A1)",
			source: entry.source,
			consentAt: new Date(now),
			createdAt: new Date(now - entry.ageDays * DAY_MS),
			updatedAt: new Date(now - entry.ageDays * DAY_MS),
		})),
		{ timestamps: false },
	);
	return docs.map((doc) => doc._id.toHexString());
}

beforeEach(async () => {
	await UserModel.create([
		{ sub: OWNER, username: "owner" },
		{ sub: USER, username: "user" },
	]);
});

describe("Pro interest admin", () => {
	it("is reserved to owners: 403 for users, 401 for guests, isOwner on /users/me", async () => {
		const [id] = await seed();
		const calls = (who: ReturnType<typeof as>) => [
			who.get("/admin/pro-interest/stats"),
			who.get("/admin/pro-interest"),
			who.get("/admin/pro-interest/export"),
			who.send("put", `/admin/pro-interest/${id}/contacted`, {
				contacted: true,
			}),
			who.send("delete", `/admin/pro-interest/${id}?dryRun=true`),
			who.send("delete", `/admin/pro-interest/${id}`),
			// Invalid input still answers 403: the owner check comes first.
			who.get("/admin/pro-interest?pageSize=9999&need=crypto"),
			who.send("put", `/admin/pro-interest/${id}/contacted`, {
				contacted: "yes",
			}),
			who.send("delete", `/admin/pro-interest/${id}?dryRun=maybe`),
		];
		for (const res of await Promise.all(calls(as(USER)))) {
			expect(res.status).toBe(403);
			expect(res.body.error.code).toBe("FORBIDDEN");
		}
		for (const res of await Promise.all(calls(guest()))) {
			expect(res.status).toBe(401);
		}
		expect(
			await FeedbackModel.countDocuments({ contactedAt: { $ne: null } }),
		).toBe(0);
		expect(await FeedbackModel.countDocuments()).toBe(3);
		expect((await as(OWNER).get("/users/me")).body.isOwner).toBe(true);
		expect((await as(USER).get("/users/me")).body.isOwner).toBe(false);
	});

	it("counts totals, recent entries, sources and needs", async () => {
		await seed();
		const res = await as(OWNER).get("/admin/pro-interest/stats");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			total: 3,
			new7d: 1,
			new30d: 2,
			bySource: [
				{ source: "landing", count: 2 },
				{ source: "plan_limit_projects", count: 1 },
			],
			byNeed: [
				{ need: "mock", count: 2 },
				{ need: "mcp", count: 1 },
				{ need: "team", count: 1 },
			],
		});
	});

	it("lists newest first with filters and pages", async () => {
		const [first] = await seed();
		const page = await as(OWNER).get("/admin/pro-interest?pageSize=2&page=1");
		expect(page.body.total).toBe(3);
		expect(page.body.items[0]).toMatchObject({
			emailMatchesAccount: false,
			submissions: [],
		});
		expect(page.body.items.map((i: { email: string }) => i.email)).toEqual([
			"a@x.com",
			"b@x.com",
		]);
		const filtered = async (query: string) =>
			(await as(OWNER).get(`/admin/pro-interest?${query}`)).body.items.map(
				(i: { email: string }) => i.email,
			);
		expect(await filtered("need=team")).toEqual(["a@x.com"]);
		expect(await filtered("source=plan_limit_projects")).toEqual([
			"=cmd@evil.com",
		]);
		expect(await filtered("q=B%40X")).toEqual(["b@x.com"]);
		expect(await filtered("q=.*")).toEqual([]);

		const marked = await as(OWNER).send(
			"put",
			`/admin/pro-interest/${first}/contacted`,
			{
				contacted: true,
			},
		);
		expect(marked.body.contactedAt).toEqual(expect.any(String));
		expect(await filtered("contacted=true")).toEqual(["a@x.com"]);
		expect(await filtered("contacted=false")).toEqual([
			"b@x.com",
			"=cmd@evil.com",
		]);
		const unmarked = await as(OWNER).send(
			"put",
			`/admin/pro-interest/${first}/contacted`,
			{
				contacted: false,
			},
		);
		expect(unmarked.body.contactedAt).toBeNull();
	});

	it("exports CSV that spreadsheets cannot run as formulas", async () => {
		await seed();
		const res = await as(OWNER).get(
			"/admin/pro-interest/export?source=plan_limit_projects",
		);
		expect(res.status).toBe(200);
		expect(res.body.filename).toMatch(/^pro-interest-\d{4}-\d{2}-\d{2}\.csv$/);
		const lines: string[] = res.body.csv.replace(/^\uFEFF/, "").split("\r\n");
		expect(lines[0]).toBe(
			"email,name,needs,teamSize,priceHint,note,source,userSub,consentAt,createdAt,updatedAt,contactedAt,emailMatchesAccount",
		);
		expect(lines).toHaveLength(3);
		const row = lines[1] ?? "";
		expect(row.startsWith("'=cmd@evil.com,")).toBe(true);
		expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
		expect(row).toContain(",'+SUM(A1),");
		for (const cell of row.split(",")) expect(cell).not.toMatch(/^[=+\-@]/);
	});

	it("deletes an entry on request, previewing first", async () => {
		const [id] = await seed();
		const preview = await as(OWNER).send(
			"delete",
			`/admin/pro-interest/${id}?dryRun=true`,
		);
		expect(preview.body).toEqual({ id, deleted: false, dryRun: true });
		expect(await FeedbackModel.countDocuments()).toBe(3);
		const real = await as(OWNER).send("delete", `/admin/pro-interest/${id}`);
		expect(real.body.deleted).toBe(true);
		expect(await FeedbackModel.countDocuments()).toBe(2);
		expect(
			(await as(OWNER).send("delete", `/admin/pro-interest/${id}`)).status,
		).toBe(404);
		expect(
			(await as(OWNER).send("delete", "/admin/pro-interest/nope")).status,
		).toBe(404);
	});
});
