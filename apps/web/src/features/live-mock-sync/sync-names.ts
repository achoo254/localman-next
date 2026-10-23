import type { Translate } from "../../i18n/translate";
import type { SyncNames } from "./live-mock-sync-api";

/** `{name}` kept as is: the server puts each resource's name there. */
const KEEP = { name: "{name}" };

/** What the sync names, in the language on screen. */
export function syncNamesOf(t: Translate): SyncNames {
	return {
		list: t("apiClientOpen.names.list", KEEP),
		get: t("apiClientOpen.names.get", KEEP),
		create: t("apiClientOpen.names.create", KEEP),
		update: t("apiClientOpen.names.update", KEEP),
		patch: t("apiClientOpen.names.patch", KEEP),
		delete: t("apiClientOpen.names.delete", KEEP),
		removedFolder: t("liveMockSync.names.removedFolder"),
		removedItem: t("liveMockSync.names.removedItem"),
		environment: t("liveMockSync.names.environment", KEEP),
	};
}
