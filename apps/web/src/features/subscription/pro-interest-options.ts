/**
 * Choices offered by the Pro interest form. The ids come from
 * `@localman/shared` (what the API accepts); the Vietnamese labels are shared
 * by the form and the admin page.
 */
import {
	PRO_INTEREST_NEEDS,
	PRO_INTEREST_SOURCES,
	PRO_INTEREST_TEAM_SIZES,
	type ProInterestNeed,
	type ProInterestSource,
	type ProInterestTeamSize,
} from "@localman/shared";

export interface Choice<T extends string = string> {
	id: T;
	label: string;
}

const NEED_LABELS: Readonly<Record<ProInterestNeed, string>> = {
	mock: "Mock API",
	api_client: "API Client",
	team: "Team",
	devops_ci: "DevOps/CI",
	mcp: "MCP",
	tunelo: "Tunelo",
};

const TEAM_LABELS: Readonly<Record<ProInterestTeamSize, string>> = {
	"1": "1 người",
	"2-5": "2–5",
	"6-20": "6–20",
	">20": "Trên 20",
};

export const PRO_NEEDS: readonly Choice<ProInterestNeed>[] =
	PRO_INTEREST_NEEDS.map((id) => ({ id, label: NEED_LABELS[id] }));

export const TEAM_SIZES: readonly Choice<ProInterestTeamSize>[] =
	PRO_INTEREST_TEAM_SIZES.map((id) => ({ id, label: TEAM_LABELS[id] }));

/** Empty id means "not sure" and is not sent. */
export const PRICE_HINTS: readonly Choice[] = [
	{ id: "", label: "Chưa rõ" },
	{ id: "lt100", label: "Dưới 100.000đ mỗi tháng" },
	{ id: "100-250", label: "100.000–250.000đ mỗi tháng" },
	{ id: "250-500", label: "250.000–500.000đ mỗi tháng" },
	{ id: "gt500", label: "Trên 500.000đ mỗi tháng" },
];

/** Where the form was opened from; the API keeps only whitelisted values. */
export type { ProInterestSource };

const SOURCE_LABELS: Readonly<Record<ProInterestSource, string>> = {
	landing: "Landing · thẻ Pro",
	pricing: "Bảng giá",
	subscription_modal: "Quản lý gói",
	plan_limit_projects: "Giới hạn project",
	plan_limit_resources: "Giới hạn resource",
	plan_limit_proxy: "Hết quota proxy",
	devops: "DevOps",
	account: "Tài khoản",
	other: "Khác",
};

export const PRO_SOURCES: readonly Choice<ProInterestSource>[] =
	PRO_INTEREST_SOURCES.map((id) => ({ id, label: SOURCE_LABELS[id] }));

/** The need that most likely brought the user here is pre-ticked. */
export const SOURCE_NEED: Readonly<
	Partial<Record<ProInterestSource, ProInterestNeed>>
> = {
	plan_limit_projects: "mock",
	plan_limit_resources: "mock",
	plan_limit_proxy: "api_client",
	devops: "devops_ci",
};

/** Label for a stored id; unknown ids (older or newer values) show as-is. */
export function choiceLabel(list: readonly Choice[], id: string): string {
	return list.find((choice) => choice.id === id)?.label ?? id;
}
