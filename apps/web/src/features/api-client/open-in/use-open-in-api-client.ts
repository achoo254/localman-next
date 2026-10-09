import { useCallback } from "react";
import { useNavigate } from "react-router";
import {
	API_CLIENT_PATH,
	type OpenInApiClient,
	openInApiClientState,
} from "./open-in-state";

/** Goes to `/api-client`, which opens the target's requests as tabs. */
export function useOpenInApiClient(): (target: OpenInApiClient) => void {
	const navigate = useNavigate();
	return useCallback(
		(target: OpenInApiClient) => {
			void navigate(API_CLIENT_PATH, { state: openInApiClientState(target) });
		},
		[navigate],
	);
}
