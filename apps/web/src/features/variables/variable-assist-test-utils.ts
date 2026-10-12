import { fireEvent, screen, waitFor } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import {
	ACTIVE,
	LIST,
	byId,
	summary,
} from "../environments/environments-test-utils";

export const ACTIVE_STAGING = {
	[`GET ${ACTIVE}`]: { body: { workspaceId: "w-team", environmentId: "e1" } },
	[`GET ${LIST}`]: { body: { items: [summary()] } },
};

/** A new request tab with `url` typed in; resolves to the URL input. */
export async function typeUrl(url: string): Promise<HTMLInputElement> {
	const add = await waitFor(() => {
		const found = byId("tabbar-new");
		if (!found) throw new Error("no new-tab button");
		return found;
	});
	fireEvent.click(add);
	const input = await waitFor(() => {
		const found = byId("request-url");
		if (!(found instanceof HTMLInputElement)) throw new Error("no URL input");
		return found;
	});
	fireEvent.change(input, { target: { value: url } });
	return input;
}

/** Selects `from..to` of `input` and opens "Set as variable" from the offer. */
export async function setAsVariable(
	user: ReturnType<typeof userEvent.setup>,
	input: HTMLInputElement,
	from: number,
	to: number,
): Promise<HTMLElement> {
	input.setSelectionRange(from, to);
	fireEvent.select(input);
	const offer = await screen.findByRole("button", { name: "Set as variable" });
	await user.click(offer);
	return screen.findByRole("dialog", { name: "Set as variable" });
}

export const kindOf = (name: string) =>
	document.querySelector(`[data-var="${name}"]`)?.getAttribute("data-kind");
