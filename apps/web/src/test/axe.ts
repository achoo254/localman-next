import axe from "axe-core";

/**
 * Serious and critical axe violations under `root`, as readable strings.
 * Colour contrast is off: jsdom has no layout, and `pnpm check:tokens`
 * checks the token pairs instead. Callers stub
 * `HTMLCanvasElement.prototype.getContext` (axe probes fonts via canvas).
 */
export async function seriousViolations(root: Element): Promise<string[]> {
	const result = await axe.run(root, {
		rules: { "color-contrast": { enabled: false } },
	});
	return result.violations
		.filter((v) => v.impact === "serious" || v.impact === "critical")
		.map(
			(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
		);
}
