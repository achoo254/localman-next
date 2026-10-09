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
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { LandingSection } from "./landing-section";

interface Feature {
	slug: string;
	title: string;
	description: ReactNode;
	code: string;
	icon: Icon;
	docs?: string;
	/** Only for the two cards the phase asks to announce. */
	comingSoon?: boolean;
}

const FEATURES: readonly Feature[] = [
	{
		slug: "pagination",
		title: "Phân trang",
		description: "Chia trang danh sách bằng query string.",
		code: "?page=1&limit=10",
		icon: IconListNumbers,
		docs: "/docs/code-examples",
	},
	{
		slug: "sorting",
		title: "Sắp xếp",
		description: "Sắp xếp theo field bất kỳ, tăng hoặc giảm dần.",
		code: "?sortBy=createdAt&order=desc",
		icon: IconArrowsSort,
		docs: "/docs/code-examples",
	},
	{
		slug: "filtering",
		title: "Lọc",
		description: "Tìm trên mọi field hoặc lọc theo một field.",
		code: "?search=Hà Nội · ?name=An",
		icon: IconFilter,
		docs: "/docs/code-examples",
	},
	{
		slug: "generator",
		title: "Sinh dữ liệu",
		description: `${FAKER_METHOD_IDS.length} method Faker.js, sinh tới ${MAX_GENERATE_COUNT} bản ghi mỗi lần bấm.`,
		code: "name.fullName",
		icon: IconWand,
		docs: "/docs",
	},
	{
		slug: "custom-response",
		title: "Tuỳ biến response",
		description: (
			<>
				Template riêng cho từng endpoint, dùng biến <code>"$mockData"</code>,{" "}
				<code>"$count"</code> và Faker.js.
			</>
		),
		code: '{ "items": "$mockData", "total": "$count" }',
		icon: IconBraces,
		docs: "/docs/custom-responses",
	},
	{
		slug: "collaboration",
		title: "Cộng tác",
		description:
			"Mời đồng đội bằng username, email hoặc link mời, cùng chỉnh một project.",
		code: "pending → accepted",
		icon: IconUsers,
	},
	{
		slug: "custom-endpoints",
		title: "Custom endpoint",
		description: "Tự định nghĩa đường dẫn và method ngoài CRUD mặc định.",
		code: "POST /auth/login",
		icon: IconRoute,
		comingSoon: true,
	},
	{
		slug: "webhooks",
		title: "Webhook",
		description: "Gọi URL của bạn mỗi khi dữ liệu thay đổi.",
		code: "on: create, update",
		icon: IconWebhook,
		comingSoon: true,
	},
];

/** "Và nhiều hơn": what the mock already does, plus two announced cards. */
export function MoreFeaturesSection() {
	return (
		<LandingSection
			id="features"
			data-id="landing-features"
			eyebrow="Tính năng"
			title="Và nhiều hơn"
		>
			<ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
				{FEATURES.map((feature) => (
					<li key={feature.slug} className="grid">
						<article
							data-id={`feature-${feature.slug}`}
							className={cn(cardClassName, "grid content-start gap-3 p-6")}
						>
							<div className="flex items-center justify-between gap-2">
								<feature.icon
									size={24}
									aria-hidden="true"
									className="text-primary"
								/>
								{feature.comingSoon ? (
									<Badge tone="accent">Sắp có</Badge>
								) : null}
							</div>
							<h3 className="m-0 font-bold font-mono text-base">
								{feature.title}
							</h3>
							<p className="m-0 text-muted text-sm">{feature.description}</p>
							<code
								// Announced cards dim their code with the muted text token
								// rather than opacity, so it keeps 4.5:1 contrast.
								className={cn(
									"break-all text-[0.8125rem]",
									feature.comingSoon ? "text-muted" : "text-primary",
								)}
							>
								{feature.code}
							</code>
							{feature.docs ? (
								<Link
									to={feature.docs}
									data-id={`feature-${feature.slug}-docs`}
									className="justify-self-start font-mono font-semibold text-[0.8125rem]"
								>
									Xem ví dụ
									<span className="sr-only">: {feature.title}</span>
								</Link>
							) : null}
						</article>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}
