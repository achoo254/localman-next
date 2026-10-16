import type {
	ConflictSide,
	MergeConflictView,
} from "@localman/shared/api-client";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";

const RADIO =
	"flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-border p-2 has-checked:border-primary has-checked:bg-primary/6 has-focus-visible:outline-2 has-focus-visible:outline-primary";

export interface ConflictListProps {
	conflicts: readonly MergeConflictView[];
	choices: Readonly<Record<string, ConflictSide>>;
	onChoose: (choices: Record<string, ConflictSide>) => void;
	/** "Source is …; destination is …", for this direction. */
	sides: string;
}

/**
 * A value as compact text; `undefined` is a deleted entity, or a field
 * that side does not have.
 */
function Value({ value, whole }: { value: unknown; whole: boolean }) {
	const t = useT();
	const text =
		value === undefined
			? t(
					whole
						? "versionControl.conflicts.deleted"
						: "versionControl.conflicts.empty",
				)
			: typeof value === "string"
				? value
				: JSON.stringify(value, null, 2);
	return (
		<pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-fg/6 p-2 font-mono text-xs">
			{text}
		</pre>
	);
}

/** Every conflict with Keep Source / Keep Destination, and both for all. */
export function ConflictList({
	conflicts,
	choices,
	onChoose,
	sides,
}: ConflictListProps) {
	const t = useT();
	const all = (side: ConflictSide) =>
		onChoose(
			Object.fromEntries(conflicts.map((conflict) => [conflict.id, side])),
		);
	return (
		<section data-id="modal-conflicts" className="grid gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="m-0 flex-1 font-semibold text-sm">
					{t("versionControl.conflicts.title", { count: conflicts.length })}
				</h3>
				<Button
					size="sm"
					variant="ghost"
					data-id="modal-conflicts-keep-all-source"
					onClick={() => all("source")}
				>
					{t("versionControl.conflicts.keepAllSource")}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					data-id="modal-conflicts-keep-all-dest"
					onClick={() => all("destination")}
				>
					{t("versionControl.conflicts.keepAllDestination")}
				</Button>
			</div>
			<p className="m-0 text-muted text-xs">
				{t("versionControl.conflicts.intro")} {sides}
			</p>
			<ol className="m-0 grid list-none gap-2 p-0">
				{conflicts.map((conflict) => {
					const kind = t(`versionControl.kinds.${conflict.entityKind}`);
					const where =
						conflict.path === ""
							? t("versionControl.conflicts.whole", { kind })
							: conflict.path;
					return (
						<li
							key={conflict.id}
							data-id="modal-conflicts-item"
							className="grid gap-2 rounded-md border border-border-subtle p-2"
						>
							<span className="text-sm">
								<b>{conflict.name}</b>{" "}
								<span className="font-mono text-muted text-xs">{where}</span>
							</span>
							<div className="grid gap-2 md:grid-cols-2">
								{(["source", "destination"] as const).map((side) => (
									<label key={side} className={RADIO}>
										<input
											type="radio"
											name={`conflict-${conflict.id}`}
											checked={choices[conflict.id] === side}
											data-id={`modal-conflicts-${side}`}
											className="mt-1 size-4 accent-primary-solid"
											onChange={() =>
												onChoose({ ...choices, [conflict.id]: side })
											}
										/>
										<span className="grid min-w-0 flex-1 gap-1">
											<span className="font-semibold text-xs">
												{side === "source"
													? t("versionControl.conflicts.keepSource")
													: t("versionControl.conflicts.keepDestination")}
											</span>
											<Value
												value={conflict[side]}
												whole={conflict.path === ""}
											/>
										</span>
									</label>
								))}
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
