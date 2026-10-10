import { useCallback } from "react";
import { useNavigate } from "react-router";
import {
	API_CLIENT_PATH,
	type OpenInApiClient,
	openInApiClientState,
} from "./open-in-state";

/**
 * Goes to `/api-client`, which opens the target as tabs: a project's or
 * resource's mock requests, or one request log line.
 */
export function useOpenInApiClient(): (target: OpenInApiClient) => void {
	const navigate = useNavigate();
	return useCallback(
		(target: OpenInApiClient) => {
			void navigate(API_CLIENT_PATH, { state: openInApiClientState(target) });
		},
		[navigate],
	);
}
