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

/** Toast after a generator write: bold count, resource name in mono. */
function generatedToast(resource: Resource, count: number) {
	const name = <b className="font-mono">{resource.name}</b>;
	return count > 0
		? {
				title: "Đã sinh dữ liệu",
				description: (
					<>
						<b>{count}</b> bản ghi cho {name}.
					</>
				),
			}
		: {
				title: "Đã reset dữ liệu",
				description: <>{name} không còn bản ghi nào.</>,
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
	const toast = useToast();
	const generation = useGenerateResource(projectId);
	const fail = (error: unknown) =>
		toast.show({ tone: "error", title: resourceErrorMessage(error) });

	function run(resource: Resource, count: number) {
		generation.mutate(
			{ resource, count },
			{
				onSuccess: () => toast.show(generatedToast(resource, count)),
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
		askConfirm({
			title: count > 0 ? "Sinh dữ liệu" : "Xoá dữ liệu",
			question:
				count > 0
					? `Sinh ${count} bản ghi cho “${resource.name}”?`
					: `Xoá mọi bản ghi của “${resource.name}”?`,
			lead: "Các resource con sau sẽ mất dữ liệu:",
			confirmLabel: count > 0 ? "Sinh dữ liệu" : "Xoá dữ liệu",
			changes: lost,
			"data-id": "modal-generate-resource",
			run: async () => {
				await localized(generation.mutateAsync({ resource, count }));
				toast.show(generatedToast(resource, count));
			},
		});
	}

	return generate;
}
