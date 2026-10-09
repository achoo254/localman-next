import { MAX_GENERATE_COUNT } from "@localman/shared/constants";

/** Size of the bar in the prototype and in the source (106×25). */
export const GENERATOR_WIDTH = 106;
export const GENERATOR_HEIGHT = 25;

/** Horizontal position of a count on the bar. */
export const generatorX = (value: number): number =>
	(value / MAX_GENERATE_COUNT) * GENERATOR_WIDTH;

export interface GeneratorGraphicProps {
	/** Prefix of the SVG gradient and pattern ids (unique per bar). */
	ids: string;
	value: number;
	/** Count under the pointer or picked with the keyboard, if any. */
	preview: number | null;
	blocked: boolean;
}

/**
 * Drawing of the generator bar: grey track, gradient fill scaled to the
 * count (200ms ease, none with reduced motion), hatching when blocked and
 * a guide line at the previewed count. Colours come from tokens only.
 */
export function GeneratorGraphic({
	ids,
	value,
	preview,
	blocked,
}: GeneratorGraphicProps) {
	return (
		<svg
			width={GENERATOR_WIDTH}
			height={GENERATOR_HEIGHT}
			viewBox={`0 0 ${GENERATOR_WIDTH} ${GENERATOR_HEIGHT}`}
			aria-hidden="true"
			focusable="false"
			className="block"
		>
			<defs>
				<linearGradient id={`${ids}-fill`} x1="0" x2="1" y1="0" y2="0">
					<stop
						offset="0"
						style={{
							stopColor:
								"color-mix(in srgb, var(--c-primary) 45%, var(--c-surface))",
						}}
					/>
					<stop offset="1" style={{ stopColor: "var(--c-primary)" }} />
				</linearGradient>
				<pattern
					id={`${ids}-hatch`}
					width="6"
					height="6"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<line
						x1="0"
						y1="0"
						x2="0"
						y2="6"
						className="stroke-border"
						strokeWidth={2}
					/>
				</pattern>
			</defs>
			<rect
				width={GENERATOR_WIDTH}
				height={GENERATOR_HEIGHT}
				className="fill-bar-track"
			/>
			{blocked ? (
				<rect
					width={GENERATOR_WIDTH}
					height={GENERATOR_HEIGHT}
					fill={`url(#${ids}-hatch)`}
				/>
			) : (
				<rect
					data-part="fill"
					width={GENERATOR_WIDTH}
					height={GENERATOR_HEIGHT}
					fill={`url(#${ids}-fill)`}
					style={{ transform: `scaleX(${value / MAX_GENERATE_COUNT})` }}
					className="origin-left transition-transform duration-(--dur-base) ease-standard [transform-box:fill-box] motion-reduce:transition-none"
				/>
			)}
			{preview === null ? null : (
				<line
					x1={generatorX(preview)}
					x2={generatorX(preview)}
					y1={3}
					y2={GENERATOR_HEIGHT - 3}
					strokeWidth={1.5}
					className="stroke-fg opacity-70"
				/>
			)}
		</svg>
	);
}
