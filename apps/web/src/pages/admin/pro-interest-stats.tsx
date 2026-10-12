import { cardClassName } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { BarList } from "./bar-list";
import type { CountBy, ProInterestStats } from "./pro-interest-admin-api";
import {
	type Choice,
	choiceLabel,
	proNeeds,
	proSources,
} from "./pro-interest-options";

function toBars(list: CountBy[], labels: readonly Choice[]) {
	return [...list]
		.sort((a, b) => b.count - a.count)
		.map(({ key, count }) => ({ key, count, label: choiceLabel(labels, key) }));
}

function Kpi({
	id,
	label,
	value,
}: { id: string; label: string; value: number }) {
	const { formatNumber } = useI18n();
	return (
		<article
			data-id={`admin-pro-kpi-${id}`}
			className={cn(cardClassName, "grid gap-1 px-6 py-4")}
		>
			<span className="text-[0.8125rem] text-muted">{label}</span>
			<span className="font-bold font-mono text-3xl leading-tight">
				{formatNumber(value)}
			</span>
		</article>
	);
}

/** Totals, new sign-ups and the two breakdown charts. */
export function ProInterestStatsView({ stats }: { stats: ProInterestStats }) {
	const { t } = useI18n();
	return (
		<>
			<div
				data-id="admin-pro-kpis"
				className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3"
			>
				<Kpi id="total" label={t("admin.pro.kpiTotal")} value={stats.total} />
				<Kpi id="7d" label={t("admin.pro.kpi7d")} value={stats.new7d} />
				<Kpi id="30d" label={t("admin.pro.kpi30d")} value={stats.new30d} />
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<section
					data-id="admin-pro-by-source"
					aria-labelledby="admin-pro-by-source-title"
					className={cn(cardClassName, "grid content-start gap-3 p-6")}
				>
					<h2
						id="admin-pro-by-source-title"
						className="m-0 font-bold font-mono text-sm"
					>
						{t("admin.pro.bySource")}
					</h2>
					<BarList
						dataId="admin-pro-source"
						bars={toBars(stats.bySource, proSources(t))}
					/>
				</section>
				<section
					data-id="admin-pro-by-need"
					aria-labelledby="admin-pro-by-need-title"
					className={cn(cardClassName, "grid content-start gap-3 p-6")}
				>
					<h2
						id="admin-pro-by-need-title"
						className="m-0 font-bold font-mono text-sm"
					>
						{t("admin.pro.byNeed")}
					</h2>
					<BarList
						dataId="admin-pro-need"
						bars={toBars(stats.byNeed, proNeeds(t))}
					/>
				</section>
			</div>
		</>
	);
}
