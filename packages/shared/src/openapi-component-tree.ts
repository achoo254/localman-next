/**
 * Child → parent links between the components of an OpenAPI import
 * (`schema-inference-openapi.ts`), kept a forest within the depth cap.
 */
import { MAX_RESOURCE_DEPTH } from "./resource-constants.js";

export class ComponentTree {
	readonly parent = new Map<string, { schema: string; field: string }>();

	private depth(schema: string): number {
		let depth = 1;
		for (
			let at = this.parent.get(schema);
			at;
			at = this.parent.get(at.schema)
		) {
			depth += 1;
		}
		return depth;
	}

	private height(schema: string): number {
		let height = 1;
		for (const [child, link] of this.parent) {
			if (link.schema === schema)
				height = Math.max(height, 1 + this.height(child));
		}
		return height;
	}

	/** Why `child` cannot nest under `parent`, or `null` after linking it. */
	link(parent: string, child: string, field: string): string | null {
		const owner = this.parent.get(child);
		if (child === parent) return "Refers to its own schema";
		if (owner) return `"${child}" is already nested under "${owner.schema}"`;
		for (
			let at: string | undefined = parent;
			at;
			at = this.parent.get(at)?.schema
		) {
			if (at === child) return `Nesting "${child}" here would form a loop`;
		}
		if (this.depth(parent) + this.height(child) > MAX_RESOURCE_DEPTH) {
			return `Resources nest at most ${MAX_RESOURCE_DEPTH} levels`;
		}
		this.parent.set(child, { schema: parent, field });
		return null;
	}
}
