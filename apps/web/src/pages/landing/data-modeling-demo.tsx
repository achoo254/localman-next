import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import {
	DEMO_USERS,
	DEMO_USER_SCHEMA,
	demoUsersJson,
} from "../../content/landing-samples";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LandingSection } from "./landing-section";

const CARD = cn(cardClassName, "grid min-w-0 overflow-hidden");
const CARD_HEAD =
	"flex items-center justify-between gap-2 border-border-subtle border-b px-4 py-3";
const CELL = "border-border-subtle border-t px-4 py-2";
const PAGES = Math.ceil(DEMO_USERS.length / 2);

/**
 * "Simple data modeling": the `users` schema table and a sample
 * response. Samples come from a fixture; the landing never runs Faker, so
 * the button shows another stored sample instead of generating one.
 */
export function DataModelingDemo() {
	const [page, setPage] = useState(0);
	const t = useT();
	return (
		<LandingSection
			id="modeling"
			data-id="landing-modeling"
			eyebrow="Schema"
			title={t("landing.modeling.title")}
			lead={t("landing.modeling.lead")}
			className="lg:grid-cols-8 lg:items-start lg:gap-12"
			headerClassName="lg:col-span-3"
		>
			<div className="grid min-w-0 gap-4 lg:col-span-5">
				<section
					data-id="landing-modeling-schema"
					aria-label={t("landing.modeling.schemaLabel")}
					className={CARD}
				>
					<div className={CARD_HEAD}>
						<h3 className="m-0 font-bold font-mono text-sm">users · schema</h3>
						<Badge>
							{t("landing.modeling.fieldCount", {
								count: DEMO_USER_SCHEMA.length,
							})}
						</Badge>
					</div>
					<section
						aria-label={t("landing.modeling.tableLabel")}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
						tabIndex={0}
						className="overflow-x-auto"
					>
						<table className="w-full min-w-120 border-collapse text-left text-sm">
							<thead>
								<tr className="font-mono text-muted text-xs">
									<th scope="col" className="px-4 py-2">
										Field
									</th>
									<th scope="col" className="px-4 py-2">
										Type
									</th>
									<th scope="col" className="px-4 py-2">
										Method
									</th>
								</tr>
							</thead>
							<tbody className="font-mono">
								{DEMO_USER_SCHEMA.map((field) => (
									<tr
										key={field.name}
										className={field.type === "Object ID" ? "text-muted" : ""}
									>
										<th scope="row" className={cn(CELL, "font-semibold")}>
											{field.name}
										</th>
										<td className={CELL}>{field.type}</td>
										<td className={CELL}>
											{field.fakerMethod ? (
												<code className="text-primary">
													{field.fakerMethod}
												</code>
											) : (
												<>
													<span aria-hidden="true">—</span>
													<span className="sr-only">
														{t("landing.modeling.none")}
													</span>
												</>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</section>
				<section
					data-id="landing-modeling-preview"
					aria-label={t("landing.modeling.previewLabel")}
					className={CARD}
				>
					<div className={CARD_HEAD}>
						<h3 className="m-0 font-mono text-sm">
							<Badge tone="success">GET</Badge>{" "}
							<code className="font-semibold">/users</code>
						</h3>
					</div>
					<pre className="m-0 max-h-80 overflow-auto bg-surface-subtle px-4 py-3 text-[0.8125rem] leading-[1.6]">
						<code>{demoUsersJson(page)}</code>
					</pre>
					<div className="flex flex-wrap items-center justify-between gap-2 border-border-subtle border-t px-4 py-2">
						<span className="font-mono text-muted text-xs">
							{t("landing.modeling.sampleSource")}
						</span>
						<Button
							size="sm"
							data-id="landing-modeling-reroll"
							onClick={() => setPage((current) => (current + 1) % PAGES)}
						>
							{t("landing.modeling.reroll")}
						</Button>
					</div>
				</section>
			</div>
		</LandingSection>
	);
}
