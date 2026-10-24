import { brand } from "@localman/shared/brand";
import {
	DATA_ITEMS,
	type DataItem,
	type DataItemId,
	type DataPlace,
} from "@localman/shared/data-policy";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";

const PLACE_TONE: Readonly<Record<DataPlace, BadgeTone>> = {
	device: "success",
	serverSealed: "success",
	serverEncrypted: "info",
	server: "neutral",
	passing: "accent",
};

type DetailKey = `dataTransparency.items.${DataItemId}.detail`;

/**
 * The detail of an item, `{app}` and `{token}` filled in. `t` fills
 * placeholders by name and ignores those a text does not use; the cast
 * only widens its per-key signature to the one shape every detail takes.
 */
function detailOf(t: Translate, id: DataItemId): string {
	const translate = t as (
		key: DetailKey,
		params: { app: string; token: string },
	) => string;
	return translate(`dataTransparency.items.${id}.detail`, {
		app: brand.appName,
		token: "{{variables}}",
	});
}

/** How long the server keeps an item, from the policy's numbers. */
export function keptText(t: Translate, item: DataItem): string {
	if (item.place === "device") return t("dataTransparency.kept.neverSent");
	if (item.place === "passing") return t("dataTransparency.kept.notStored");
	const { keptDays, maxEntries } = item;
	if (keptDays === null) return t("dataTransparency.kept.untilDeleted");
	const days =
		typeof keptDays === "number"
			? t("dataTransparency.kept.days", { count: keptDays })
			: t("dataTransparency.kept.daysByLimits", {
					standard: keptDays[0],
					extended: keptDays[1],
				});
	return maxEntries === null
		? days
		: `${days}, ${t("dataTransparency.kept.cap", { count: maxEntries })}`;
}

/** Every item of the data policy: what it is, where it lives, how long. */
export function DataItemsTable() {
	const t = useT();
	return (
		// Scrolls sideways on a narrow screen: focusable, so keys scroll it too.
		<section
			aria-labelledby="your-data-items-caption"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take focus for keyboard users.
			tabIndex={0}
			className="overflow-x-auto"
		>
			<table
				data-id="your-data-items"
				className="w-full border-collapse text-left text-sm"
			>
				<caption id="your-data-items-caption" className="sr-only">
					{t("dataTransparency.table.caption")}
				</caption>
				<thead>
					<tr className="border-border-subtle border-b text-muted text-xs">
						<th scope="col" className="py-2 pr-4 font-normal">
							{t("dataTransparency.table.data")}
						</th>
						<th scope="col" className="py-2 pr-4 font-normal">
							{t("dataTransparency.table.where")}
						</th>
						<th scope="col" className="py-2 font-normal">
							{t("dataTransparency.table.kept")}
						</th>
					</tr>
				</thead>
				<tbody>
					{DATA_ITEMS.map((item) => (
						<tr
							key={item.id}
							data-id="your-data-item"
							data-item={item.id}
							className="border-border-subtle border-b align-top last:border-b-0"
						>
							<td className="py-3 pr-4">
								<div className="grid gap-1">
									<span className="font-semibold">
										{t(`dataTransparency.items.${item.id}.title`)}
									</span>
									<span className="text-muted">
										{renderRich(detailOf(t, item.id))}
									</span>
								</div>
							</td>
							<td className="py-3 pr-4">
								<Badge tone={PLACE_TONE[item.place]} data-place={item.place}>
									{t(`dataTransparency.places.${item.place}`)}
								</Badge>
							</td>
							<td className="py-3 text-muted" data-id="your-data-item-kept">
								{keptText(t, item)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
