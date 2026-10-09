import { useToast } from "../../components/ui/toast";
import type { DataConfirm } from "../../features/resources/data-changes-confirm-modal";
import {
	hasDescendantData,
	lostDescendants,
} from "../../features/resources/data-loss";
import { generateResourceData } from "../../features/resources/resource-data-api";
import {
	localized,
	resourceErrorMessage,
} from "../../features/resources/resource-errors";
import type { Resource } from "../../features/resources/resource-model";
import { useGenerateResource } from "../../features/resources/use-resources";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { toastText } from "./toast-text";

/** Toast after a generator write: bold count, resource name in mono. */
function generatedToast(resource: Resource, count: number, t: Translate) {
	const { name } = resource;
	return count > 0
		? {
				title: t("projectDetail.toast.generated"),
				description: toastText(
					t("projectDetail.toast.recordsFor", { count, name }),
				),
			}
		: {
				title: t("projectDetail.toast.reset"),
				description: toastText(t("projectDetail.toast.noRecords", { name })),
			};
}

/**
 * Generator bar action. It runs at once (optimistic) unless a resource
 * below holds records: then a dry run tells whether the write would drop
 * them, and the user confirms the listed losses first.
 */
export function useGenerateAction(
	projectId: string,
	resources: readonly Resource[],
	askConfirm: (confirm: DataConfirm) => void,
) {
	const t = useT();
	const toast = useToast();
	const generation = useGenerateResource(projectId);
	const fail = (error: unknown) =>
		toast.show({ tone: "error", title: resourceErrorMessage(error, t) });

	function run(resource: Resource, count: number) {
		generation.mutate(
			{ resource, count },
			{
				onSuccess: () => toast.show(generatedToast(resource, count, t)),
				onError: fail,
			},
		);
	}

	async function generate(resource: Resource, count: number) {
		if (!hasDescendantData(resources, resource.id)) {
			run(resource, count);
			return;
		}
		let lost: ReturnType<typeof lostDescendants>;
		try {
			lost = lostDescendants(
				await generateResourceData(projectId, resource.id, count, true),
				resource.id,
			);
		} catch (error) {
			fail(error);
			return;
		}
		if (lost.length === 0) {
			run(resource, count);
			return;
		}
		const action =
			count > 0
				? t("projectDetail.generate.title")
				: t("projectDetail.generate.clearTitle");
		askConfirm({
			title: action,
			question:
				count > 0
					? t("projectDetail.generate.question", { count, name: resource.name })
					: t("projectDetail.generate.clearQuestion", { name: resource.name }),
			lead: t("resources.lostLead"),
			confirmLabel: action,
			changes: lost,
			"data-id": "modal-generate-resource",
			run: async () => {
				await localized(generation.mutateAsync({ resource, count }), t);
				toast.show(generatedToast(resource, count, t));
			},
		});
	}

	return generate;
}
