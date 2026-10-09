import { useI18n } from "../../i18n/i18n-context";

export interface Bar {
	key: string;
	label: string;
	count: number;
}

/** Horizontal bar chart drawn with token colours; counts are also text. */
export function BarList({ bars, dataId }: { bars: Bar[]; dataId: string }) {
	const { t, formatNumber } = useI18n();
	if (bars.length === 0) {
		return <p className="m-0 text-muted text-sm">{t("admin.noData")}</p>;
	}
	const max = Math.max(1, ...bars.map((bar) => bar.count));
	return (
		<ul className="m-0 grid list-none gap-2 p-0">
			{bars.map((bar) => (
				<li
					key={bar.key}
					data-id={`${dataId}-${bar.key}`}
					className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-[0.8125rem]"
				>
					<span className="truncate" title={bar.label}>
						{bar.label}
					</span>
					<span
						aria-hidden="true"
						className="h-2.5 overflow-hidden rounded-full bg-bar-track"
					>
						<span
							className="block h-full rounded-full bg-primary"
							style={{ width: `${Math.round((bar.count / max) * 100)}%` }}
						/>
					</span>
					<span className="text-right font-bold font-mono">
						{formatNumber(bar.count)}
					</span>
				</li>
			))}
		</ul>
	);
}
