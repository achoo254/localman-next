import { useId } from "react";
import { CodeBlock } from "../../components/ui/code-block";
import { useT } from "../../i18n/i18n-context";
import { apiUrl } from "../../lib/api-url";
import { appPageUrl } from "../../platform/navigation";
import { AccessKeyCreate } from "./access-key-create";
import { AccessKeyList } from "./access-key-list";
import { publicCollectionPath } from "./access-keys-api";

/** Placeholder of the sample: the real key is never printed in it. */
const KEY_PLACEHOLDER = "<YOUR_KEY>";

/** `curl` reading the collection with a key; absolute even with a relative API base. */
export function accessKeyCurl(collectionId: string): string {
	const url = appPageUrl(apiUrl(publicCollectionPath(collectionId)));
	return `curl "${url}?access_key=${KEY_PLACEHOLDER}"`;
}

/** "Keys" tab of the Share dialog: create, list and revoke access keys. */
export function AccessKeysTab({ collectionId }: { collectionId: string }) {
	const t = useT();
	const titleId = useId();
	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-4"
			data-id="share-keys"
		>
			<div className="grid gap-1">
				<h3 id={titleId} className="m-0 font-mono font-semibold text-sm">
					{t("publicSharing.share.keys.title")}
				</h3>
				<p className="m-0 text-muted text-[0.8125rem]">
					{t("publicSharing.share.keys.text")}
				</p>
			</div>
			<AccessKeyCreate collectionId={collectionId} />
			<AccessKeyList collectionId={collectionId} />
			<CodeBlock
				caption={t("publicSharing.share.keys.sampleCaption")}
				code={accessKeyCurl(collectionId)}
				wrap
				data-id="share-keys-curl"
			/>
		</section>
	);
}
