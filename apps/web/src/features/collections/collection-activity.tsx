import { useI18n } from "../../i18n/i18n-context";
import { initialOf } from "../../lib/initial";
import { describeChange } from "./describe-change";
import { useRightPanel } from "./right-panel-context";
import { useActivity } from "./use-changelog";

/** The last 5 changes of a collection, and a way to the full changelog. */
export function CollectionActivity({ collectionId }: { collectionId: string }) {
	const { t, formatDate } = useI18n();
	const activity = useActivity(collectionId);
	const { setPanel } = useRightPanel();
	const items = activity.data ?? [];
	return (
		<section
			data-id="collection-activity"
			aria-labelledby="collection-activity-title"
			className="grid content-start gap-2"
		>
			<h3 id="collection-activity-title" className="m-0 font-semibold text-sm">
				{t("collections.activity.title")}
			</h3>
			{activity.isError ? (
				<p className="m-0 text-error-text text-xs">
					{t("collections.activity.loadFailed")}
				</p>
			) : null}
			{activity.isSuccess && items.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("collections.activity.empty")}
				</p>
			) : null}
			<ul className="m-0 grid list-none gap-2 p-0">
				{items.map((item) => (
					<li
						key={item.id}
						data-id="collection-activity-item"
						className="flex gap-2"
					>
						<span
							aria-hidden="true"
							className="grid size-6 flex-none place-items-center rounded-full bg-primary/10 font-bold text-[0.625rem] text-primary"
						>
							{initialOf(item.authorName)}
						</span>
						<span className="grid min-w-0 text-xs">
							<span>
								<b>
									{item.authorName ?? t("collections.changelog.removedAccount")}
								</b>{" "}
								{item.viaMcp ? (
									<span
										data-id="collection-activity-via-mcp"
										className="text-muted"
									>
										({t("collections.changelog.viaMcp")}){" "}
									</span>
								) : null}
								{describeChange(item, t)}
							</span>
							<span className="text-muted">{formatDate(item.at)}</span>
						</span>
					</li>
				))}
			</ul>
			<button
				type="button"
				data-id="collection-activity-open"
				className="cursor-pointer justify-self-start border-0 bg-transparent p-0 font-semibold text-primary text-xs underline"
				onClick={() => setPanel("changelog")}
			>
				{t("collections.activity.openChangelog")}
			</button>
		</section>
	);
}
