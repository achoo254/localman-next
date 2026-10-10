import type { AnyOperation } from "@localman/operations";
import { accessRequestOperations } from "./access-request-operations.js";
import { elementOperations } from "./element-operations.js";
import { shareOperations } from "./share-operations.js";

/** Element sharing, access request and move operations (registered in the registry). */
export const accessOperations: readonly AnyOperation[] = [
	...elementOperations,
	...shareOperations,
	...accessRequestOperations,
];
