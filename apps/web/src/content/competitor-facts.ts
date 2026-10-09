import type { PlanLimits } from "@localman/shared/constants";
import type { FeatureName } from "../config/features";

/**
 * Public Free-plan facts of mockapi.io and Postman for the landing
 * comparison. Update `updatedAt` whenever a value is re-checked; every
 * competitor cell names the source it was read from. Localman's own cells
 * are computed from `FREE_LIMITS`, never typed here.
 */

export type CompetitorSourceId =
	| "postman-pricing"
	| "postman-agent"
	| "postman-mock"
	| "mockapi";

export interface CompetitorSource {
	readonly id: CompetitorSourceId;
	readonly label: string;
	readonly url: string;
}

export interface CompetitorCell {
	readonly text: string;
	readonly sourceId: CompetitorSourceId;
}

export interface ComparisonRow {
	readonly key: string;
	readonly label: string;
	readonly localman: (free: PlanLimits) => string;
	readonly mockapi: CompetitorCell;
	readonly postman: CompetitorCell;
	/** Feature that must be in production before the row is shown. */
	readonly requires?: FeatureName;
}

export interface CompetitorFacts {
	/** ISO date the facts were last read (`yyyy-mm-dd`). */
	readonly updatedAt: string;
	readonly sources: readonly CompetitorSource[];
	readonly rows: readonly ComparisonRow[];
	readonly note: string;
}

export const COMPETITOR_FACTS: CompetitorFacts = {
	updatedAt: "2026-10-08",
	sources: [
		{
			id: "postman-pricing",
			label: "Postman Pricing",
			url: "https://www.postman.com/pricing/",
		},
		{
			id: "postman-agent",
			label: "About the Postman Agent",
			url: "https://learning.postman.com/docs/getting-started/basics/about-postman-agent/",
		},
		{
			id: "postman-mock",
			label: "Postman mock servers",
			url: "https://learning.postman.com/docs/design-apis/mock-apis/overview/",
		},
		{ id: "mockapi", label: "mockapi.io", url: "https://mockapi.io/" },
	],
	rows: [
		{
			key: "members",
			label: "Thành viên ở gói Free",
			localman: (free) =>
				`Tối đa ${free.membersPerWorkspace} thành viên mỗi project, tính cả bạn`,
			mockapi: { text: "1 user, không cộng tác", sourceId: "mockapi" },
			postman: {
				text: "1 user, không có viewer hay chia sẻ",
				sourceId: "postman-pricing",
			},
		},
		{
			key: "mock-free",
			label: "Mock ở gói Free",
			localman: (free) =>
				`${free.projects} project, ${free.resources} resource mỗi project`,
			mockapi: { text: "1 project, 2 resource", sourceId: "mockapi" },
			postman: {
				text: "Mock server trả example đã lưu",
				sourceId: "postman-mock",
			},
		},
		{
			key: "custom-response",
			label: "Custom response",
			localman: (free) => (free.customResponse ? "Miễn phí" : "Gói trả phí"),
			mockapi: { text: "Chỉ gói trả phí", sourceId: "mockapi" },
			postman: { text: "Có, theo example đã lưu", sourceId: "postman-mock" },
		},
		{
			key: "stateful",
			label: "Mock có trạng thái kèm quan hệ",
			localman: () =>
				"Có: CRUD, resource lồng nhau, Faker.js, không cần viết code",
			mockapi: { text: "Có (CRUD, quan hệ)", sourceId: "mockapi" },
			postman: {
				text: "Mock trả example; code mock giữ trạng thái (beta, soạn trên desktop, chạy cloud từ gói Solo)",
				sourceId: "postman-mock",
			},
		},
		{
			key: "localhost",
			label: "Gọi localhost từ web",
			localman: () => "Có, qua Tunelo, tự nhận tunnel theo port",
			mockapi: { text: "Không", sourceId: "mockapi" },
			postman: {
				text: "Phải cài Postman Desktop Agent",
				sourceId: "postman-agent",
			},
			requires: "apiClient",
		},
		{
			key: "vietnamese",
			label: "Tiếng Việt",
			localman: () => "Có, giữ thuật ngữ EN",
			mockapi: { text: "Không (EN)", sourceId: "mockapi" },
			postman: { text: "Không (EN)", sourceId: "postman-pricing" },
		},
	],
	note: "mockapi.io: hạn mức gói Free lấy từ trang giá và modal Manage subscription công khai.",
};
