import { z } from "zod";

const MIB = 1024 * 1024;
/**
 * 200 variables at their longest (name, value, description), at 3 bytes
 * a character (Vietnamese, CJK), plus room for the JSON: about 7 MB.
 */
export const VARIABLES_BODY_LIMIT = 10 * MIB;
/**
 * 500 local values at their longest would be about 15 MB at 3 bytes a
 * character; nginx caps `/api/v1/environments|workspaces|collections/`
 * at 16m, so 15 MiB is the most a request can carry anyway.
 */
export const LOCAL_VALUES_BODY_LIMIT = 15 * MIB;
export const environmentIdSchema = z.string().min(1).max(64);
export const workspaceIdSchema = z.string().min(1).max(64);
export const ENVIRONMENT_PATH = "/environments/:environmentId";
export const VALUES_NOTE =
	"Requests and scripts use the caller's local value of a variable when they have one, its shared value otherwise. A Viewer never receives a secret's shared value (`sharedHidden: true`), and neither does anyone while the server cannot decrypt it; a request using such a value stops with SECRET_WITHHELD until the caller sets a local value.";
