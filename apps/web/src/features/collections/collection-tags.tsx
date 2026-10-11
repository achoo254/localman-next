import {
	COLLECTION_TAGS_MAX,
	COLLECTION_TAG_MAX_LENGTH,
	type TagProblemCode,
	normalizeTags,
} from "@localman/shared/api-client";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";

const PROBLEM_KEYS = {
	empty: "collections.tags.problems.empty",
	"too-long": "collections.tags.problems.tooLong",
	edges: "collections.tags.problems.edges",
	characters: "collections.tags.problems.characters",
	"too-many": "collections.tags.problems.tooMany",
} as const satisfies Record<TagProblemCode, string>;

export interface CollectionTagsProps {
	tags: readonly string[];
	canEdit: boolean;
	onChange: (tags: string[]) => void;
}

/** Tags of a collection: chips with remove, a box to add one (Enter). */
export function CollectionTags({
	tags,
	canEdit,
	onChange,
}: CollectionTagsProps) {
	const t = useT();
	const titleId = useId();
	const hintId = useId();
	const [text, setText] = useState("");
	const [problem, setProblem] = useState<TagProblemCode | null>(null);
	const add = () => {
		const next = normalizeTags([...tags, text]);
		const first = next.problems[0];
		if (first) {
			setProblem(first.code);
			return;
		}
		setProblem(null);
		setText("");
		if (next.tags.length !== tags.length) onChange(next.tags);
	};
	return (
		<section
			data-id="collection-tags"
			aria-labelledby={titleId}
			className="grid content-start gap-2"
		>
			<h3 id={titleId} className="m-0 font-semibold text-sm">
				{t("collections.tags.title", {
					count: tags.length,
					max: COLLECTION_TAGS_MAX,
				})}
			</h3>
			{tags.length > 0 ? (
				<ul className="m-0 flex list-none flex-wrap gap-1 p-0">
					{tags.map((tag) => (
						<li
							key={tag}
							data-id="collection-tags-item"
							className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-subtle py-0.5 pr-1 pl-2.5 font-mono text-xs"
						>
							{tag}
							{canEdit ? (
								<button
									type="button"
									aria-label={t("collections.tags.remove", { tag })}
									className="grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-icon-muted hover:bg-fg/8 hover:text-fg"
									onClick={() => onChange(tags.filter((item) => item !== tag))}
								>
									<IconX size={12} aria-hidden="true" />
								</button>
							) : null}
						</li>
					))}
				</ul>
			) : (
				<p className="m-0 text-muted text-sm">{t("collections.tags.empty")}</p>
			)}
			{canEdit && tags.length < COLLECTION_TAGS_MAX ? (
				<div className="flex gap-2">
					<Input
						value={text}
						maxLength={COLLECTION_TAG_MAX_LENGTH + 10}
						aria-label={t("collections.tags.input")}
						aria-describedby={hintId}
						aria-invalid={problem !== null || undefined}
						placeholder={t("collections.tags.placeholder")}
						data-id="collection-tags-input"
						className="min-h-9 max-w-64 text-xs"
						onChange={(event) => {
							setText(event.target.value);
							setProblem(null);
						}}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;
							event.preventDefault();
							add();
						}}
					/>
					<Button size="sm" data-id="collection-tags-add" onClick={add}>
						<IconPlus size={16} aria-hidden="true" />
						{t("collections.tags.add")}
					</Button>
				</div>
			) : null}
			<p id={hintId} className="m-0 text-muted text-xs">
				{problem ? (
					<span role="alert" className="text-error-text">
						{t(PROBLEM_KEYS[problem], { max: COLLECTION_TAG_MAX_LENGTH })}
					</span>
				) : (
					t("collections.tags.hint", { max: COLLECTION_TAG_MAX_LENGTH })
				)}
			</p>
		</section>
	);
}
