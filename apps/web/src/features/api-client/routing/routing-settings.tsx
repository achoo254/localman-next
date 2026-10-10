import { ROUTE_MODES } from "@localman/shared/api-client";
import { type ReactNode, memo, useSyncExternalStore } from "react";
import { Button } from "../../../components/ui/button";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useToast } from "../../../components/ui/toast";
import { useI18n } from "../../../i18n/i18n-context";
import { useDelayedFlag } from "../../../lib/use-delayed-flag";
import { clientSettingsApi } from "./client-settings-api";
import { browserCorsCache } from "./cors-cache";
import { HostList } from "./host-list";
import { PinnedHostsForm } from "./pinned-hosts-form";
import { RoutingSettingsSkeleton } from "./routing-settings-skeleton";
import {
	settingsEdits,
	useClientSettings,
	useOptimisticSettingsChange,
} from "./use-client-settings";

function Section(props: {
	title: string;
	hint: string;
	children: ReactNode;
	"data-id": string;
}) {
	return (
		<section data-id={props["data-id"]} className="grid gap-2">
			<h3 className="m-0 font-semibold text-sm">{props.title}</h3>
			<p className="m-0 text-muted text-xs">{props.hint}</p>
			{props.children}
		</section>
	);
}

/**
 * Routing section of the workbench sidebar: the route of new tabs, hosts
 * always sent through the proxy, hosts where credentials may go there
 * without asking, and this browser's CORS cache.
 */
export const RoutingSettings = memo(function RoutingSettings() {
	const { t, locale } = useI18n();
	const expiry = new Intl.DateTimeFormat(locale, {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Saigon",
	});
	const toast = useToast();
	const { settings, isPending } = useClientSettings();
	const skeleton = useDelayedFlag(isPending);
	// Shown at once and put back with a toast if the server refuses.
	const setRoute = useOptimisticSettingsChange(
		clientSettingsApi.setDefaultRoute,
		settingsEdits.defaultRoute,
	);
	const pin = useOptimisticSettingsChange(
		clientSettingsApi.pinHost,
		settingsEdits.pinHost,
	);
	const unpin = useOptimisticSettingsChange(
		clientSettingsApi.unpinHost,
		settingsEdits.unpinHost,
	);
	const forgetSecrets = useOptimisticSettingsChange(
		clientSettingsApi.forgetSecrets,
		settingsEdits.forgetSecrets,
	);
	const cache = browserCorsCache();
	const blocked = useSyncExternalStore(cache.subscribe, cache.list);

	return (
		<div data-id="settings-routing" className="grid gap-5 p-3">
			<h2 className="m-0 font-bold font-mono text-base">
				{t("apiClientRouting.settings.title")}
			</h2>
			{skeleton ? <RoutingSettingsSkeleton /> : null}
			{isPending || skeleton ? null : (
				<>
					<Section
						title={t("apiClientRouting.settings.defaultRoute")}
						hint={t("apiClientRouting.settings.defaultHint")}
						data-id="settings-routing-auto"
					>
						<SegmentedControl
							legend={t("apiClientRouting.settings.defaultRoute")}
							data-id="settings-routing-default"
							value={settings.defaultRoute}
							onChange={(route) => setRoute.mutate(route)}
							options={ROUTE_MODES.map((mode) => ({
								value: mode,
								label: t(`apiClient.request.routes.${mode}`),
								"data-id": `settings-routing-default-${mode}`,
							}))}
						/>
					</Section>
					<Section
						title={t("apiClientRouting.settings.pinned.title")}
						hint={t("apiClientRouting.settings.pinned.hint")}
						data-id="settings-routing-hosts"
					>
						<PinnedHostsForm onAdd={(host) => pin.mutate(host)} />
						<HostList
							items={settings.routingHosts.map((host) => ({ host }))}
							empty={t("apiClientRouting.settings.pinned.empty")}
							removeLabel={(host) =>
								t("apiClientRouting.settings.pinned.remove", { host })
							}
							onRemove={(host) => unpin.mutate(host)}
							data-id="settings-routing-host"
						/>
					</Section>
					<Section
						title={t("apiClientRouting.settings.secrets.title")}
						hint={t("apiClientRouting.settings.secrets.hint")}
						data-id="settings-routing-secrets"
					>
						<HostList
							items={settings.secretProxyHosts.map((host) => ({ host }))}
							empty={t("apiClientRouting.settings.secrets.empty")}
							removeLabel={(host) =>
								t("apiClientRouting.settings.secrets.remove", { host })
							}
							onRemove={(host) => forgetSecrets.mutate(host)}
							data-id="settings-routing-secret"
						/>
					</Section>
				</>
			)}
			<Section
				title={t("apiClientRouting.settings.cors.title")}
				hint={t("apiClientRouting.settings.cors.hint")}
				data-id="settings-routing-cors"
			>
				<HostList
					items={blocked.map((entry) => ({
						host: entry.origin,
						detail: t("apiClientRouting.settings.cors.until", {
							time: expiry.format(entry.expiresAt),
						}),
					}))}
					empty={t("apiClientRouting.settings.cors.empty")}
					removeLabel={(origin) =>
						t("apiClientRouting.settings.cors.forget", { origin })
					}
					onRemove={cache.forget}
					data-id="settings-routing-cors-origin"
				/>
				{blocked.length > 0 ? (
					<div>
						<Button
							size="sm"
							data-id="settings-routing-cors-clear"
							onClick={() => {
								cache.clear();
								toast.show({
									tone: "info",
									title: t("apiClientRouting.settings.cors.cleared"),
								});
							}}
						>
							{t("apiClientRouting.settings.cors.clear")}
						</Button>
					</div>
				) : null}
			</Section>
		</div>
	);
});
