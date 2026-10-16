import type {
	ConflictSide,
	MergeOption,
	MergePreview,
} from "@localman/shared/api-client";
import { MERGE_OPTIONS } from "@localman/shared/api-client";
import { useT } from "../../i18n/i18n-context";
import { ConflictList } from "./conflict-list";

const RADIO =
	"flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-border p-2 has-checked:border-primary has-checked:bg-primary/6 has-disabled:cursor-not-allowed has-disabled:opacity-60";

export interface SyncChoicesProps {
	preview: MergePreview;
	choices: Record<string, ConflictSide>;
	onChoose: (choices: Record<string, ConflictSide>) => void;
	/** Which side is which, above the conflicts. */
	sides: string;
	/** For a merge: the option chosen; absent for a pull. */
	merge?: {
		option: MergeOption;
		onOption: (option: MergeOption) => void;
		/** Editor of the fork: the two other options. */
		canEditFork: boolean;
	};
}

/** The changes a pull or merge makes, its conflicts and, for a merge, what follows. */
export function SyncChoices({
	preview,
	choices,
	onChoose,
	sides,
	merge,
}: SyncChoicesProps) {
	const t = useT();
	return (
		<>
			<section className="grid gap-1">
				<h3 className="m-0 font-semibold text-sm">
					{t("versionControl.sync.changes")}
				</h3>
				<ul
					data-id="sync-changes"
					className="m-0 grid list-none gap-1 p-0 text-sm"
				>
					{preview.changes.map((change) => (
						<li key={change.key}>
							{t(`versionControl.sync.${change.kind}`, {
								kind: t(`versionControl.kinds.${change.entityKind}`),
								name: change.name,
							})}
						</li>
					))}
				</ul>
			</section>
			{preview.conflicts.length > 0 ? (
				<ConflictList
					conflicts={preview.conflicts}
					choices={choices}
					onChoose={onChoose}
					sides={sides}
				/>
			) : null}
			{merge ? (
				<fieldset className="m-0 grid gap-2 border-0 p-0">
					<legend className="mb-1 font-semibold text-sm">
						{t("versionControl.sync.option")}
					</legend>
					{MERGE_OPTIONS.map((value) => {
						const needsEditor = value !== "merge" && !merge.canEditFork;
						return (
							<label
								key={value}
								className={RADIO}
								title={
									needsEditor
										? t("versionControl.sync.optionNeedsEditor")
										: undefined
								}
							>
								<input
									type="radio"
									name="merge-option"
									checked={merge.option === value}
									disabled={needsEditor}
									data-id={`modal-merge-opt-${value}`}
									className="mt-1 size-4 accent-primary-solid"
									onChange={() => merge.onOption(value)}
								/>
								<span className="text-sm">
									{t(`versionControl.sync.options.${value}`)}
								</span>
							</label>
						);
					})}
				</fieldset>
			) : null}
		</>
	);
}
