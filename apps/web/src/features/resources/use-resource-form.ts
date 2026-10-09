import { type FormEvent, type RefObject, useMemo, useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import { resourceErrorMessage } from "./resource-errors";
import {
	hasDraftErrors,
	revealErrors,
	serverBehaviorErrors,
} from "./resource-form-errors";
import {
	type DraftErrors,
	type ResourceDraft,
	draftOf,
	placeOf,
} from "./resource-form-state";
import { validateDraft } from "./resource-form-validation";
import type { Resource } from "./resource-model";
import { createResource, updateResource } from "./resources-api";

const NO_ERRORS: DraftErrors = { fields: {}, endpoints: {}, behavior: {} };

export interface ResourceFormOptions {
	projectId: string;
	resource: Resource | null;
	resources: readonly Resource[];
	/** The `<form>`, searched for the first invalid control after a failed submit. */
	form: RefObject<HTMLFormElement | null>;
	onSaved: (resource: Resource, created: boolean) => void;
	onPlanLimit: () => void;
}

/** Focuses the first control marked invalid once panels have opened. */
function focusFirstInvalid(form: RefObject<HTMLFormElement | null>) {
	window.setTimeout(() => {
		form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}, 0);
}

/**
 * State and submit of the resource form: checks the draft like the API,
 * opens the panels holding errors (client or API) and focuses the first.
 */
export function useResourceForm({
	projectId,
	resource,
	resources,
	form,
	onSaved,
	onPlanLimit,
}: ResourceFormOptions) {
	const t = useT();
	const place = useMemo(
		() => placeOf(resource, resources),
		[resource, resources],
	);
	const [initial] = useState(() => draftOf(resource));
	const [draft, setDraft] = useState<ResourceDraft>(initial);
	const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	function fail(next: DraftErrors) {
		setErrors(next);
		setDraft((current) => revealErrors(current, next));
		focusFirstInvalid(form);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		const result = validateDraft(draft, place, t);
		if (!result.input) return fail(result.errors);
		setErrors(NO_ERRORS);
		setBusy(true);
		setSubmitError(null);
		try {
			const saved = resource
				? await updateResource(projectId, resource.id, result.input)
				: await createResource(projectId, { ...result.input, parentId: null });
			onSaved(saved, resource === null);
		} catch (error) {
			const placed = serverBehaviorErrors(error, draft, t);
			if (isPlanLimitError(error)) onPlanLimit();
			else if (placed) fail(placed);
			else setSubmitError(resourceErrorMessage(error, t));
		} finally {
			setBusy(false);
		}
	}

	return {
		place,
		draft,
		setDraft,
		errors,
		// A wrong name is shown and focused on its own, as before.
		invalid: hasDraftErrors({ ...errors, name: undefined }),
		submitError,
		busy,
		/** The draft changed since the form opened (export uses the saved one). */
		dirty: draft !== initial,
		submit,
	};
}
