import { IconTrash } from "@tabler/icons-react";
import { IconButton } from "../../../components/ui/icon-button";
import { Switch } from "../../../components/ui/switch";
import { useT } from "../../../i18n/i18n-context";
import type { TunnelMapping } from "../routing/client-settings-api";

export interface TunnelMappingListProps {
	mappings: readonly TunnelMapping[];
	onToggle: (mapping: TunnelMapping) => void;
	onDelete: (key: string) => void;
	/** The mapping being deleted: its button spins until the server answers. */
	deletingKey: string | null;
}

/** The user's mappings: local key → tunnel origin, each on or off. */
export function TunnelMappingList({
	mappings,
	onToggle,
	onDelete,
	deletingKey,
}: TunnelMappingListProps) {
	const t = useT();
	return (
		<section data-id="settings-tunelo-mappings" className="grid gap-2">
			<h3 className="m-0 font-semibold text-sm">
				{t("apiClientTunelo.mappings.title")}
			</h3>
			<p className="m-0 text-muted text-xs">
				{t("apiClientTunelo.mappings.hint")}
			</p>
			{mappings.length === 0 ? (
				<p
					data-id="settings-tunelo-mappings-empty"
					className="m-0 text-muted text-sm"
				>
					{t("apiClientTunelo.mappings.empty")}
				</p>
			) : (
				<ul className="m-0 grid list-none gap-2 p-0">
					{mappings.map((mapping) => (
						<li
							key={mapping.key}
							data-id="settings-tunelo-mapping"
							className="grid gap-1 rounded-md border border-border-subtle bg-surface p-2"
						>
							<div className="flex items-center justify-between gap-2">
								<code className="truncate font-mono text-sm">
									{mapping.key}
								</code>
								<div className="flex flex-none items-center gap-1">
									<Switch
										checked={mapping.enabled}
										aria-label={t("apiClientTunelo.mappings.use", {
											key: mapping.key,
										})}
										data-id="settings-tunelo-mapping-toggle"
										onCheckedChange={(enabled) =>
											onToggle({ ...mapping, enabled })
										}
									/>
									<IconButton
										size="sm"
										variant="ghost"
										loading={deletingKey === mapping.key}
										label={t("apiClientTunelo.mappings.delete", {
											key: mapping.key,
										})}
										icon={<IconTrash size={16} aria-hidden="true" />}
										data-id="settings-tunelo-mapping-delete"
										onClick={() => onDelete(mapping.key)}
									/>
								</div>
							</div>
							<span className="truncate font-mono text-muted text-xs">
								{mapping.url}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
