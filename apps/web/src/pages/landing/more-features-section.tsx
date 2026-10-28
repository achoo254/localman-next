import { type FeatureItem, FeatureList } from "@achoo254/app-shell";
import { MAX_GENERATE_COUNT } from "@localman/shared/constants";
import { FAKER_METHOD_IDS } from "@localman/shared/faker-catalog";
import {
	type Icon,
	IconArrowsSort,
	IconBraces,
	IconFilter,
	IconListNumbers,
	IconRoute,
	IconUsers,
	IconWand,
	IconWebhook,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import type { en } from "../../i18n/messages/en/dictionary";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";

type FeatureKey = keyof Omit<
	typeof en.landing.features,
	"eyebrow" | "title" | "comingSoon" | "seeExample"
>;

interface Feature {
	slug: string;
	/** Title and description under `landing.features.{key}`. */
	key: FeatureKey;
	code: string;
	icon: Icon;
	docs?: string;
	/** Only for the two cards the phase asks to announce. */
	comingSoon?: boolean;
}

const FEATURES: readonly Feature[] = [
	{
		slug: "pagination",
		key: "pagination",
		code: "?page=1&limit=10",
		icon: IconListNumbers,
		docs: "/docs/code-examples",
	},
	{
		slug: "sorting",
		key: "sorting",
		code: "?sortBy=createdAt&order=desc",
		icon: IconArrowsSort,
		docs: "/docs/code-examples",
	},
	{
		slug: "filtering",
		key: "filtering",
		code: "?search=yahoo · ?name=Lynne Metz",
		icon: IconFilter,
		docs: "/docs/code-examples",
	},
	{
		slug: "generator",
		key: "generator",
		code: "name.fullName",
		icon: IconWand,
		docs: "/docs",
	},
	{
		slug: "custom-response",
		key: "customResponse",
		code: '{ "items": "$mockData", "total": "$count" }',
		icon: IconBraces,
		docs: "/docs/custom-responses",
	},
	{
		slug: "collaboration",
		key: "collaboration",
		code: "pending → accepted",
		icon: IconUsers,
	},
	{
		slug: "custom-endpoints",
		key: "customEndpoints",
		code: "POST /auth/login",
		icon: IconRoute,
		comingSoon: true,
	},
	{
		slug: "webhooks",
		key: "webhooks",
		code: "on: create, update",
		icon: IconWebhook,
		comingSoon: true,
	},
];

/**
 * "And more": what the mock already does, plus two announced cards, as the
 * shared feature list (`#features`, the header's "Features" link).
 */
export function MoreFeaturesSection() {
	const t = useT();
	const generator = {
		methods: FAKER_METHOD_IDS.length,
		max: MAX_GENERATE_COUNT,
	};
	const items: FeatureItem[] = FEATURES.map((feature) => {
		const title = t(`landing.features.${feature.key}.title`);
		const description =
			feature.key === "generator"
				? t("landing.features.generator.description", generator)
				: t(`landing.features.${feature.key}.description`);
		return {
			id: feature.slug,
			icon: <feature.icon size={20} aria-hidden="true" />,
			title: (
				<>
					{title}
					{feature.comingSoon ? (
						<Badge tone="accent" className="ml-auto">
							{t("landing.features.comingSoon")}
						</Badge>
					) : null}
				</>
			),
			description: (
				<>
					{renderRich(description)}{" "}
					<code
						// Announced cards dim their code with the muted text token
						// rather than opacity, so it keeps 4.5:1 contrast.
						className={cn(
							"block break-all pt-2 text-[0.8125rem]",
							feature.comingSoon ? "text-muted" : "text-primary",
						)}
					>
						{feature.code}
					</code>
					{feature.docs ? (
						<Link
							to={feature.docs}
							data-id={`feature-${feature.slug}-docs`}
							className="inline-block pt-2 font-mono font-semibold text-[0.8125rem]"
						>
							{t("landing.features.seeExample")}
							<span className="sr-only">: {title}</span>
						</Link>
					) : null}
				</>
			),
		};
	});
	return (
		<FeatureList
			id="features"
			dataId="landing-features"
			eyebrow={t("landing.features.eyebrow")}
			title={t("landing.features.title")}
			items={items}
		/>
	);
}
