/**
 * Choices offered by the Pro interest form. The ids come from
 * `@localman/shared` (what the API accepts); the labels come from the
 * `subscription.proInterest` messages and are shared by the form and the
 * admin page.
 */
import {
	PRO_INTEREST_NEEDS,
	PRO_INTEREST_SOURCES,
	PRO_INTEREST_TEAM_SIZES,
	type ProInterestNeed,
	type ProInterestSource,
	type ProInterestTeamSize,
} from "@localman/shared";
import type { FeatureFlags, FeatureName } from "../../config/features";
import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";

export interface Choice<T extends string = string> {
	id: T;
	label: string;
}

type ProInterestCopy = SourceMessages["subscription"]["proInterest"];
type NeedKey =
	`subscription.proInterest.needs.${keyof ProInterestCopy["needs"]}`;
type TeamKey =
	`subscription.proInterest.teamSizes.${keyof ProInterestCopy["teamSizes"]}`;
type PriceKey =
	`subscription.proInterest.priceHints.${keyof ProInterestCopy["priceHints"]}`;
type SourceKey =
	`subscription.proInterest.sources.${keyof ProInterestCopy["sources"]}`;

const NEED_KEYS: Readonly<Record<ProInterestNeed, NeedKey>> = {
	mock: "subscription.proInterest.needs.mock",
	api_client: "subscription.proInterest.needs.apiClient",
	team: "subscription.proInterest.needs.team",
	devops_ci: "subscription.proInterest.needs.devopsCi",
	mcp: "subscription.proInterest.needs.mcp",
	tunelo: "subscription.proInterest.needs.tunelo",
};

const TEAM_KEYS: Readonly<Record<ProInterestTeamSize, TeamKey>> = {
	"1": "subscription.proInterest.teamSizes.solo",
	"2-5": "subscription.proInterest.teamSizes.small",
	"6-20": "subscription.proInterest.teamSizes.medium",
	">20": "subscription.proInterest.teamSizes.large",
};

/** Empty id means "not sure" and is not sent. */
const PRICE_KEYS: ReadonlyArray<readonly [string, PriceKey]> = [
	["", "subscription.proInterest.priceHints.unsure"],
	["lt100", "subscription.proInterest.priceHints.lt100"],
	["100-250", "subscription.proInterest.priceHints.from100to250"],
	["250-500", "subscription.proInterest.priceHints.from250to500"],
	["gt500", "subscription.proInterest.priceHints.gt500"],
];

const SOURCE_KEYS: Readonly<Record<ProInterestSource, SourceKey>> = {
	landing: "subscription.proInterest.sources.landing",
	pricing: "subscription.proInterest.sources.pricing",
	subscription_modal: "subscription.proInterest.sources.subscriptionModal",
	plan_limit_projects: "subscription.proInterest.sources.planLimitProjects",
	plan_limit_resources: "subscription.proInterest.sources.planLimitResources",
	plan_limit_members: "subscription.proInterest.sources.planLimitMembers",
	plan_limit_proxy: "subscription.proInterest.sources.planLimitProxy",
	devops: "subscription.proInterest.sources.devops",
	account: "subscription.proInterest.sources.account",
	other: "subscription.proInterest.sources.elsewhere",
};

/** Every need, for the admin page (stored answers may use any of them). */
export function proNeeds(t: Translate): readonly Choice<ProInterestNeed>[] {
	return PRO_INTEREST_NEEDS.map((id) => ({ id, label: t(NEED_KEYS[id]) }));
}

export function teamSizes(
	t: Translate,
): readonly Choice<ProInterestTeamSize>[] {
	return PRO_INTEREST_TEAM_SIZES.map((id) => ({
		id,
		label: t(TEAM_KEYS[id]),
	}));
}

export function priceHints(t: Translate): readonly Choice[] {
	return PRICE_KEYS.map(([id, key]) => ({ id, label: t(key) }));
}

export function proSources(t: Translate): readonly Choice<ProInterestSource>[] {
	return PRO_INTEREST_SOURCES.map((id) => ({ id, label: t(SOURCE_KEYS[id]) }));
}

/**
 * Feature a need is about; the form offers it only once that feature is in
 * production (`false`: no flag yet, never offered). Needs not listed are
 * about what already runs (mock, project members).
 */
const NEED_FEATURE: Readonly<
	Partial<Record<ProInterestNeed, FeatureName | false>>
> = {
	api_client: "apiClient",
	tunelo: "apiClient",
	mcp: "mockMcp",
	devops_ci: false,
};

function offered(need: ProInterestNeed, flags: FeatureFlags): boolean {
	const feature = NEED_FEATURE[need];
	return feature === undefined || (feature !== false && flags[feature]);
}

/** Needs the form offers with these flags (no promise of unreleased work). */
export function proNeedsFor(
	flags: FeatureFlags,
	t: Translate,
): readonly Choice<ProInterestNeed>[] {
	return proNeeds(t).filter((choice) => offered(choice.id, flags));
}

/** Where the form was opened from; the API keeps only whitelisted values. */
export type { ProInterestSource };

/** The need that most likely brought the user here is pre-ticked. */
const SOURCE_NEED: Readonly<
	Partial<Record<ProInterestSource, ProInterestNeed>>
> = {
	plan_limit_projects: "mock",
	plan_limit_resources: "mock",
	plan_limit_members: "team",
	plan_limit_proxy: "api_client",
	devops: "devops_ci",
};

/** Need to pre-tick for `source`, unless the form does not offer it. */
export function sourceNeedFor(
	source: ProInterestSource,
	flags: FeatureFlags,
): ProInterestNeed | undefined {
	const need = SOURCE_NEED[source];
	return need !== undefined && offered(need, flags) ? need : undefined;
}

/** Label for a stored id; unknown ids (older or newer values) show as-is. */
export function choiceLabel(list: readonly Choice[], id: string): string {
	return list.find((choice) => choice.id === id)?.label ?? id;
}
