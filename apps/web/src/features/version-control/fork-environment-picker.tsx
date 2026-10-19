import { FORK_ENVIRONMENTS_MAX } from "@localman/shared/api-client";
import { Alert } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { useEnvironmentList } from "../environments/use-environments";
import { useForkErrorMessage } from "./fork-errors";

export interface ForkEnvironmentPickerProps {
	/** The source collection's workspace: its environments can come along. */
	workspaceId: string;
	selected: readonly string[];
	onChange: (ids: string[]) => void;
}

/** Environments of the collection's workspace to fork along with it. */
export function ForkEnvironmentPicker(props: ForkEnvironmentPickerProps) {
	const t = useT();
	const errorText = useForkErrorMessage();
	const environments = useEnvironmentList(props.workspaceId);
	const full = props.selected.length >= FORK_ENVIRONMENTS_MAX;
	// 404 when the caller sees no environment there (a collection shared to
	// someone outside its workspace): nothing to take along, not an error.
	const none =
		environments.error instanceof ApiError && environments.error.status === 404;
	const toggle = (id: string, on: boolean) =>
		props.onChange(
			on
				? [...props.selected, id]
				: props.selected.filter((chosen) => chosen !== id),
		);
	return (
		<fieldset
			className="m-0 grid gap-2 border-0 p-0"
			data-id="modal-fork-environments"
		>
			<legend className="mb-1 font-semibold text-sm">
				{t("versionControl.fork.environments")}
			</legend>
			<p className="m-0 text-muted text-xs">
				{t("versionControl.fork.environmentsHint", {
					max: FORK_ENVIRONMENTS_MAX,
				})}
			</p>
			{environments.isPending ? (
				<Skeleton className="h-10" />
			) : none || environments.data?.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("versionControl.fork.noEnvironments")}
				</p>
			) : environments.isError ? (
				<Alert tone="danger">{errorText(environments.error)}</Alert>
			) : (
				environments.data.map((environment) => {
					const checked = props.selected.includes(environment.id);
					return (
						<label
							key={environment.id}
							className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
						>
							<input
								type="checkbox"
								checked={checked}
								disabled={!checked && full}
								data-id="modal-fork-environment"
								className="size-4 accent-primary-solid"
								onChange={(event) =>
									toggle(environment.id, event.target.checked)
								}
							/>
							<span>{environment.name}</span>
						</label>
					);
				})
			)}
		</fieldset>
	);
}
