import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import {
	type InboxView,
	createInbox,
	inboxesKey,
	isNameTaken,
	setInboxForward,
	updateInboxResponse,
} from "./inbox-api";
import {
	type InboxDraft,
	type InboxErrors,
	type InboxField,
	type InboxValue,
	checkInbox,
	draftOfInbox,
	sameForward,
	sameResponse,
} from "./inbox-form-state";

export interface InboxFormOptions {
	projectId: string;
	/** The inbox being edited, or null to create one. */
	inbox: InboxView | null;
	form: RefObject<HTMLFormElement | null>;
	onDone: () => void;
	/** The owner's plan has no room for another inbox. */
	onPlanLimit: () => void;
}

/** Errors a change of each field makes stale. */
const CLEARS: Readonly<Record<keyof InboxDraft, readonly InboxField[]>> = {
	name: ["name"],
	status: ["status"],
	contentType: ["body"],
	body: ["body"],
	forward: ["port", "path"],
	port: ["port"],
	path: ["path"],
};

function focusFirstInvalid(form: RefObject<HTMLFormElement | null>) {
	window.setTimeout(() => {
		form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}, 0);
}

/**
 * State and submit of the inbox form. Creating with forwarding takes two
 * requests (create, then forward); when the second fails the inbox exists,
 * so the form turns into its edit form and keeps the error.
 */
export function useInboxForm({
	projectId,
	inbox,
	form,
	onDone,
	onPlanLimit,
}: InboxFormOptions) {
	const t = useT();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [stored, setStored] = useState<InboxView | null>(inbox);
	const [draft, setDraft] = useState<InboxDraft>(() => draftOfInbox(inbox));
	const [errors, setErrors] = useState<InboxErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	/** Edits a field; its errors go away as soon as the user types. */
	const change = <K extends keyof InboxDraft>(
		field: K,
		value: InboxDraft[K],
	) => {
		setDraft((current) => ({ ...current, [field]: value }));
		setErrors((current) => {
			const next = { ...current };
			for (const cleared of CLEARS[field]) delete next[cleared];
			return next;
		});
	};

	const refresh = () =>
		void queryClient.invalidateQueries({ queryKey: inboxesKey(projectId) });

	async function save(value: InboxValue, current: InboxView | null) {
		let saved = current;
		if (saved === null) {
			saved = await createInbox(projectId, value.name, value.response);
			setStored(saved);
			refresh();
		} else if (!sameResponse(saved.response, value.response)) {
			saved = await updateInboxResponse(projectId, saved.name, value.response);
		}
		const created = current === null;
		if (!sameForward(saved.forward, value.forward)) {
			try {
				saved = await setInboxForward(projectId, saved.name, value.forward);
			} catch (error) {
				if (!created) throw error;
				setFormError(
					t("webhookInbox.form.forwardFailed", {
						name: saved.name,
						reason: errorMessage(error),
					}),
				);
				return;
			}
		}
		refresh();
		toast.show({
			tone: "success",
			title: renderRich(
				created
					? t("webhookInbox.form.created", { name: saved.name })
					: t("webhookInbox.form.saved", { name: saved.name }),
			),
		});
		onDone();
	}

	async function submit() {
		if (busy) return;
		const result = checkInbox(draft, t);
		if (result.value === null) {
			setErrors(result.errors);
			focusFirstInvalid(form);
			return;
		}
		setBusy(true);
		setFormError(null);
		try {
			await save(result.value, stored);
		} catch (error) {
			if (isPlanLimitError(error)) onPlanLimit();
			else if (isNameTaken(error)) {
				setErrors({ name: t("webhookInbox.form.errors.nameTaken") });
				focusFirstInvalid(form);
			} else setFormError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	return { stored, draft, change, errors, formError, busy, submit };
}
