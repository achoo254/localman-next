import { describe, expect, it } from "vitest";
import {
	type TypeExportResource,
	exportTypeScript,
	exportZodSchemas,
} from "./type-exporters.js";

const USERS = "a".repeat(24);
const POSTS = "b".repeat(24);
const COMMENTS = "c".repeat(24);

/** users → posts → comments, plus a root resource with an awkward name. */
const TREE: readonly TypeExportResource[] = [
	{
		id: COMMENTS,
		name: "comments",
		parentId: POSTS,
		schema: [{ name: "post", type: "Parent Resource" }],
		template: {
			body: "$lorem.paragraph",
			likes: "$datatype.number",
			author: { name: "$name.fullName", verified: true, score: 4.5 },
			labels: ["$lorem.word", "fixed"],
			mixed: [1, "two", null],
			empty: [],
			unit: "$science.unit",
			literal: "$notAMethod",
			post: "dropped: the relation field wins",
		},
	},
	{
		id: USERS,
		name: "users",
		parentId: null,
		schema: [
			{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			{ name: "age", type: "Number" },
			{ name: "isActive", type: "Boolean" },
			{ name: "joined", type: "Date" },
			{ name: "first-name", type: "String" },
			{ name: "profile", type: "Object" },
			{ name: "tags", type: "Array" },
			{
				name: "home",
				type: "Faker.js",
				fakerMethod: "address.nearbyGPSCoordinate",
			},
			{ name: "posts", type: "Child Resource", childId: POSTS },
		],
	},
	{
		id: POSTS,
		name: "posts",
		parentId: USERS,
		schema: [
			{ name: "title", type: "Faker.js", fakerMethod: "lorem.sentence" },
			{ name: "views", type: "Number" },
			{ name: "author", type: "Parent Resource" },
			{ name: "comments", type: "Child Resource", childId: COMMENTS },
		],
	},
	{
		id: "d".repeat(24),
		name: "2fa-codes",
		parentId: null,
		schema: [
			{ name: "valid", type: "Faker.js", fakerMethod: "datatype.boolean" },
		],
	},
	{
		id: "e".repeat(24),
		name: "user",
		parentId: null,
		schema: [{ name: "lonely", type: "Parent Resource" }],
	},
];

describe("exportTypeScript", () => {
	const source = exportTypeScript(TREE);

	it("matches the snapshot", () => {
		expect(source).toMatchSnapshot();
	});

	it("orders parents first and keeps type names unique", () => {
		const names = [...source.matchAll(/export interface (\w+)/g)].map(
			([, name]) => name,
		);
		expect(names).toEqual([
			"UserRecord",
			"User",
			"PostRecord",
			"Post",
			"CommentRecord",
			"Comment",
			"Resource2faCode",
			"User2Record",
			"User2",
		]);
	});

	it("quotes keys that are not identifiers and types relations", () => {
		expect(source).toContain('\t"first-name": string;');
		expect(source).toContain("\tuserId: string;");
		expect(source).toContain("\tauthor: UserRecord | null;");
		expect(source).toContain("\tcomments: CommentRecord[];");
		expect(source).toContain("\tlonely: null;");
		expect(source).not.toContain("dropped");
	});
});

describe("exportZodSchemas", () => {
	const source = exportZodSchemas(TREE);

	it("matches the snapshot", () => {
		expect(source).toMatchSnapshot();
	});

	it("defines record schemas before the schemas that embed them", () => {
		const at = (text: string) => source.indexOf(text);
		expect(at("export const userRecordSchema =")).toBeLessThan(
			at("author: userRecordSchema.nullable(),"),
		);
		expect(at("export const postRecordSchema =")).toBeLessThan(
			at("posts: z.array(postRecordSchema),"),
		);
		expect(at("export const commentRecordSchema =")).toBeLessThan(
			at("comments: z.array(commentRecordSchema),"),
		);
		expect(
			at("export const userSchema = userRecordSchema.extend("),
		).toBeGreaterThan(at("export const commentRecordSchema ="));
	});

	it("skips forbidden keys of a template", () => {
		const template = JSON.parse('{"__proto__": 1, "ok": 2}') as {
			ok: number;
		};
		const out = exportZodSchemas([
			{ id: "1", name: "things", parentId: null, schema: [], template },
		]);
		expect(out).toContain("ok: z.number(),");
		expect(out).not.toContain("__proto__");
	});
});
