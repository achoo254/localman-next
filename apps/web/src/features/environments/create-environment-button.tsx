import { IconPlus } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { useCreateEnvironment } from "./use-create-environment";

/**
 * "+" next to the environment selector: creates an environment, opens it
 * and makes it active. Shown to those who may create (the selector's menu
 * says why the others can't).
 */
export function CreateEnvironmentButton({
	workspaceId,
}: {
	workspaceId: string;
}) {
	const t = useT();
	const create = useCreateEnvironment(workspaceId, { activate: true });
	return (
		<IconButton
			size="sm"
			data-id="tabbar-env-create"
			label={t("environments.selector.create")}
			title={t("environments.selector.create")}
			loading={create.isPending}
			icon={<IconPlus size={16} aria-hidden="true" />}
			onClick={() => create.mutate()}
		/>
	);
}
