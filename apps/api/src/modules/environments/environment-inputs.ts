import { z } from "zod";

const MIB = 1024 * 1024;
/** 200 variables of up to 10,000 characters with descriptions. */
export const VARIABLES_BODY_LIMIT = 3 * MIB;
/** 500 local values of up to 10,000 characters. */
export const LOCAL_VALUES_BODY_LIMIT = 6 * MIB;
export const environmentIdSchema = z.string().min(1).max(64);
export const workspaceIdSchema = z.string().min(1).max(64);
export const ENVIRONMENT_PATH = "/environments/:environmentId";
export const VALUES_NOTE =
	"Requests and scripts use the caller's local value of a variable when they have one, its shared value otherwise. A Viewer never receives a secret's shared value (`sharedHidden: true`), and neither does anyone while the server cannot decrypt it; a request using such a value stops with SECRET_WITHHELD until the caller sets a local value.";
