import {
	type FormEvent,
	type RefObject,
	useMemo,
	useRef,
	useState,
} from "react";
import { useT } from "../../i18n/i18n-context";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import type { CallbacksController } from "../mock-callbacks/use-callbacks-editor";
import {
	changedParentKey,
	parentKeyError,
	serverParentKeyError,
	takenNamesOf,
} from "./parent-key";
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
import type { Resource, ResourceInput } from "./resource-model";
import { createResource, updateResource } from "./resources-api";
import { useResourceCache } from "./use-resources";

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

/** The resource was saved but its callbacks were not (`reason` says why). */
export interface PartialSave {
	reason: string;
}

/** Focuses the first control marked invalid once panels have opened. */
function focusFirstInvalid(form: RefObject<HTMLFormElement | null>) {
	window.setTimeout(() => {
		form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}, 0);
}

/**
 * State and submit of the resource form: checks the draft (and the
 * callbacks) like the API, opens the panels holding errors (client or API)
 * and focuses the first. Update writes the resource, then the callbacks
 * when they changed; if only the resource got saved, the form stays open
 * and says so, and the next Update skips the resource unless it changed.
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
	const cache = useResourceCache(projectId);
	const callbacks = useRef<CallbacksController | null>(null);
	const place = useMemo(
		() => placeOf(resource, resources),
		[resource, resources],
	);
	const [initial] = useState(() => draftOf(resource));
	const [draft, setDraft] = useState<ResourceDraft>(initial);
	const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [partial, setPartial] = useState<PartialSave | null>(null);
	/** The resource as saved by an Update whose callbacks then failed. */
	const [savedAs, setSavedAs] = useState<{
		draft: ResourceDraft;
		resource: Resource;
	} | null>(null);
	const [busy, setBusy] = useState(false);

	function fail(next: DraftErrors) {
		setErrors(next);
		setDraft((current) => revealErrors(current, next));
		focusFirstInvalid(form);
	}

	/** The API's answer placed on the fields it blames, or null. */
	function placedErrors(error: unknown): DraftErrors | null {
		const placed = serverBehaviorErrors(error, draft, t);
		const key = changedParentKey(draft, place);
		const refused =
			key === null
				? null
				: serverParentKeyError(error, key, takenNamesOf(draft), t);
		if (refused === null) return placed;
		return { ...(placed ?? NO_ERRORS), parentKey: refused };
	}

	async function writeResource(input: ResourceInput): Promise<Resource> {
		if (!resource) {
			return createResource(projectId, { ...input, parentId: null });
		}
		if (savedAs?.draft === draft) return savedAs.resource;
		return updateResource(projectId, resource.id, input);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		const result = validateDraft(draft, place, t);
		const callbacksValid = callbacks.current?.check() ?? true;
		if (!result.input || !callbacksValid) return fail(result.errors);
		setErrors(NO_ERRORS);
		setBusy(true);
		setSubmitError(null);
		setPartial(null);
		let saved: Resource;
		try {
			saved = await writeResource(result.input);
		} catch (error) {
			const placed = placedErrors(error);
			if (isPlanLimitError(error)) onPlanLimit();
			else if (placed) fail(placed);
			else setSubmitError(resourceErrorMessage(error, t));
			setBusy(false);
			return;
		}
		const outcome = (await callbacks.current?.save()) ?? {
			status: "unchanged",
		};
		setBusy(false);
		if (outcome.status !== "failed") return onSaved(saved, resource === null);
		setSavedAs({ draft, resource: saved });
		setPartial({ reason: outcome.message });
		// The tree shows the saved resource even if the user cancels now.
		void cache.invalidate();
	}

	/** Typing a parent key checks it at once and drops the API's verdict. */
	function setParentKey(parentKey: string) {
		setDraft((current) => ({ ...current, parentKey }));
		setErrors(({ parentKey: _stale, ...rest }) => rest);
	}
	const typedKey = changedParentKey(draft, place);
	const keyError =
		errors.parentKey ??
		(typedKey === null
			? undefined
			: parentKeyError(typedKey, takenNamesOf(draft), t));

	return {
		place,
		draft,
		setDraft,
		errors,
		// A wrong name is shown and focused on its own, as before.
		invalid: hasDraftErrors({ ...errors, name: undefined }),
		submitError,
		partial,
		setParentKey,
		parentKeyError: keyError,
		busy,
		/** The draft changed since the form opened (export uses the saved one). */
		dirty: draft !== initial,
		callbacks,
		submit,
	};
}
