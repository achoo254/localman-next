import { describe, expect, it } from "vitest";
import {
	PARENT_KEY_MAX,
	legacyParentKeyOf,
	parentKeyIssue,
	parentKeyOf,
	resourceParentKey,
} from "./parent-key.js";

describe("parentKeyOf", () => {
	it.each([
		// Wrong under the old rule (heavy-data UI review).
		["quizzes", "quizId"],
		["statuses", "statusId"],
		["analyses", "analysisId"],
		["people", "personId"],
		["series", "seriesId"],
		["news", "newsId"],
		["children", "childId"],
		["indices", "indexId"],
		["buses", "busId"],
		["heroes", "heroId"],
		[
			"customer-relationship-management-01",
			"customerRelationshipManagement01Id",
		],
		// Right under the old rule, and still right.
		["categories", "categoryId"],
		["addresses", "addressId"],
		["boxes", "boxId"],
		["wishlists", "wishlistId"],
		["courses", "courseId"],
		["data", "dataId"],
		["users", "userId"],
		["address", "addressId"],
		// More irregular plurals and suffix rules.
		["men", "manId"],
		["women", "womanId"],
		["houses", "houseId"],
		["matches", "matchId"],
		["dishes", "dishId"],
		["theses", "thesisId"],
		["cases", "caseId"],
		["sizes", "sizeId"],
		["movies", "movieId"],
		["status", "statusId"],
		["People", "PersonId"],
		["order-items", "orderItemId"],
		["blog_posts", "blogPostId"],
		["user-quizzes", "userQuizId"],
		["2fa-codes", "_2faCodeId"],
	])("%s → %s", (name, key) => {
		expect(parentKeyOf(name)).toBe(key);
		expect(parentKeyIssue(key)).toBeNull();
	});
});

describe("legacyParentKeyOf", () => {
	it("keeps the old rule for resources stored before keys were", () => {
		expect(legacyParentKeyOf("quizzes")).toBe("quizzId");
		expect(legacyParentKeyOf("people")).toBe("peopleId");
		expect(legacyParentKeyOf("customer-relationship-01")).toBe(
			"customer-relationship-01Id",
		);
		expect(legacyParentKeyOf("categories")).toBe("categoryId");
	});
});

describe("resourceParentKey", () => {
	it("prefers the stored key and falls back to the old rule", () => {
		expect(resourceParentKey({ parentKey: "ownerId" }, "users")).toBe(
			"ownerId",
		);
		expect(resourceParentKey({}, "people")).toBe("peopleId");
		expect(resourceParentKey({ parentKey: null }, "people")).toBe("peopleId");
	});
});

describe("parentKeyIssue", () => {
	it.each([
		"",
		"a".repeat(PARENT_KEY_MAX + 1),
		"1userId",
		"user-id",
		"user id",
		"user.id",
		"id",
		"__proto__",
		"constructor",
	])("refuses %j", (key) => {
		expect(parentKeyIssue(key)).not.toBeNull();
	});

	it.each(["userId", "_owner", "$parent", "a".repeat(PARENT_KEY_MAX)])(
		"accepts %j",
		(key) => {
			expect(parentKeyIssue(key)).toBeNull();
		},
	);
});
