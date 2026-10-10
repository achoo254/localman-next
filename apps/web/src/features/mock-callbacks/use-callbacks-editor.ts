import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { type CallbackDraft, draftOf, newDraft } from "./callback-draft";
import {
	type CallbackErrors,
	type EditorErrors,
	checkDrafts,
	serverErrors,
} from "./callback-validation";
import {
	type ResourceCallbacks,
	callbacksKey,
	saveCallbacks,
} from "./callbacks-api";

export interface CallbacksEditorOptions {
	projectId: string;
	resourceId: string;
	data: ResourceCallbacks;
	/** The section, searched for the field to focus. */
	section: RefObject<HTMLElement | null>;
}

/** Errors a change of each draft field makes stale. */
const CLEARS: Partial<Record<keyof CallbackDraft, (keyof CallbackErrors)[]>> = {
	target: ["target"],
	bodyTemplate: ["body"],
	headers: ["headers", "headerRows"],
};

function focusLater(section: RefObject<HTMLElement | null>, selector: string) {
	window.setTimeout(() => {
		section.current?.querySelector<HTMLElement>(selector)?.focus();
	}, 0);
}

/**
 * Drafts of a resource's callbacks, saved together with one `PUT`
 * (separately from the resource). Errors show after Save and leave a
 * field as soon as it changes.
 */
export function useCallbacksEditor({
	projectId,
	resourceId,
	data,
	section,
}: CallbacksEditorOptions) {
	const t = useT();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [drafts, setDrafts] = useState(() => data.callbacks.map(draftOf));
	const [dirty, setDirty] = useState(false);
	const [errors, setErrors] = useState<EditorErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const update = <K extends keyof CallbackDraft>(
		key: string,
		field: K,
		value: CallbackDraft[K],
	) => {
		setDrafts((list) =>
			list.map((draft) =>
				draft.key === key ? { ...draft, [field]: value } : draft,
			),
		);
		setDirty(true);
		setErrors((current) => {
			const own = current[key];
			if (!own) return current;
			const next = { ...own };
			for (const cleared of CLEARS[field] ?? []) delete next[cleared];
			return { ...current, [key]: next };
		});
	};

	const add = () => {
		if (drafts.length >= data.max) return;
		const draft = newDraft(data.defaultBodyTemplate);
		setDrafts((list) => [...list, draft]);
		setDirty(true);
		focusLater(
			section,
			`[data-callback="${draft.key}"] [data-id="resource-form-callback-target"]`,
		);
	};

	const remove = (key: string) => {
		setDrafts((list) => list.filter((draft) => draft.key !== key));
		setErrors(({ [key]: _gone, ...rest }) => rest);
		setDirty(true);
		focusLater(section, '[data-id="resource-form-callback-add"]');
	};

	/** Errors found by Send test for one draft. */
	const showErrors = (key: string, found: CallbackErrors) => {
		setErrors((current) => ({ ...current, [key]: found }));
		focusLater(section, `[data-callback="${key}"] [aria-invalid="true"]`);
	};

	function fail(found: EditorErrors) {
		setErrors(found);
		setFormError(t("mockCallbacks.invalid"));
		focusLater(section, '[aria-invalid="true"]');
	}

	async function save() {
		if (busy) return;
		const checked = checkDrafts(drafts, t);
		if (checked.inputs === null) return fail(checked.errors);
		setErrors({});
		setFormError(null);
		setBusy(true);
		try {
			const saved = await saveCallbacks(projectId, resourceId, checked.inputs);
			queryClient.setQueryData(callbacksKey(projectId, resourceId), saved);
			setDrafts(saved.callbacks.map(draftOf));
			setDirty(false);
			toast.show({ tone: "success", title: t("mockCallbacks.saved") });
		} catch (error) {
			const placed = serverErrors(error, drafts, t);
			if (placed) fail(placed);
			else setFormError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	return {
		drafts,
		dirty,
		errors,
		formError,
		busy,
		update,
		add,
		remove,
		showErrors,
		save,
	};
}
