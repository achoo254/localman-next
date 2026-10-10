import { memo, useState } from "react";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { useDelayedFlag } from "../../../lib/use-delayed-flag";
import {
	type TunnelMapping,
	clientSettingsApi,
} from "../routing/client-settings-api";
import {
	settingsEdits,
	useClientSettings,
	useOptimisticSettingsChange,
	useSettingsChange,
} from "../routing/use-client-settings";
import { TuneloSteps } from "./tunelo-steps";
import { TunnelMappingForm } from "./tunnel-mapping-form";
import { TunnelMappingList } from "./tunnel-mapping-list";
import { TunnelMappingsSkeleton } from "./tunnel-mappings-skeleton";
import { TunnelWarning } from "./tunnel-warning";

/** Port shown in `tunelo http <port>` until an address is typed. */
const DEFAULT_PORT = 3000;

/**
 * Tunelo section of the workbench sidebar: how to open a tunnel, the
 * form mapping a local address to it, and the user's mappings (on/off,
 * delete). Mappings live in the account's client settings.
 */
export const TuneloSidebar = memo(function TuneloSidebar() {
	const t = useT();
	const toast = useToast();
	const { settings, data, isPending } = useClientSettings();
	const skeleton = useDelayedFlag(isPending);
	const [port, setPort] = useState<number | null>(null);
	const save = useSettingsChange(clientSettingsApi.setTunnel);
	// On/off shows at once and flips back with a toast if refused.
	const toggle = useOptimisticSettingsChange(
		clientSettingsApi.setTunnel,
		settingsEdits.toggleTunnel,
	);
	const remove = useSettingsChange(clientSettingsApi.deleteTunnel);

	const add = (mapping: TunnelMapping) => {
		save.mutate(mapping, {
			onSuccess: () =>
				toast.show({
					tone: "success",
					title: t("apiClientTunelo.form.saved", { key: mapping.key }),
				}),
		});
	};

	return (
		<div data-id="settings-tunelo" className="grid gap-4 p-3">
			<div className="grid gap-1">
				<h2 className="m-0 font-bold font-mono text-base">
					{t("apiClientTunelo.title")}
				</h2>
				<p data-id="settings-tunelo-keyword" className="m-0 text-muted text-xs">
					{t("apiClientTunelo.intro")}
				</p>
			</div>
			<TuneloSteps port={port ?? DEFAULT_PORT} />
			<TunnelWarning />
			<TunnelMappingForm
				onSave={add}
				busy={save.isPending}
				domains={data?.tunnelDomains ?? null}
				onPortChange={setPort}
			/>
			{skeleton ? <TunnelMappingsSkeleton /> : null}
			{isPending || skeleton ? null : (
				<TunnelMappingList
					mappings={settings.tunnelMappings}
					deletingKey={remove.isPending ? (remove.variables ?? null) : null}
					onToggle={(mapping) => toggle.mutate(mapping)}
					onDelete={(key) => remove.mutate(key)}
				/>
			)}
		</div>
	);
});
