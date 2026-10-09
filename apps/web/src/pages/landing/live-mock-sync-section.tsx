import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { LandingSection } from "./landing-section";

interface Names {
	plural: string;
	singular: string;
}

const BEFORE: Names = { plural: "users", singular: "user" };
const AFTER: Names = { plural: "members", singular: "member" };

function requestsOf({ plural, singular }: Names) {
	return [
		{ name: `List ${plural}`, method: "GET", path: `/${plural}` },
		{ name: `Get ${singular}`, method: "GET", path: `/${plural}/:id` },
		{ name: `Create ${singular}`, method: "POST", path: `/${plural}` },
		{ name: `Update ${singular}`, method: "PUT", path: `/${plural}/:id` },
		{ name: `Delete ${singular}`, method: "DELETE", path: `/${plural}/:id` },
	];
}

const CARD = cn(cardClassName, "grid content-start gap-3 p-6");
const CARD_TITLE = "m-0 font-bold font-mono text-sm";

/**
 * "Live Mock Sync" illustration: renaming the mock resource updates the
 * paths of the generated collection while user edits (a header) stay.
 * Loaded only when the `liveMockSync` flag is on.
 */
export function LiveMockSyncSection() {
	const [renamed, setRenamed] = useState(false);
	const names = renamed ? AFTER : BEFORE;
	const requests = requestsOf(names);
	return (
		<LandingSection
			id="live-sync"
			data-id="landing-live-sync"
			eyebrow="Live Mock Sync"
			title="Đổi mock, collection tự cập nhật"
			lead="Mock có trạng thái tự sinh một collection kèm environment chạy được ngay, và giữ chúng đồng bộ. Đổi tên resource thì path của request đổi theo; header hay body bạn đã sửa vẫn được giữ."
		>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="primary"
					data-id="landing-live-sync-play"
					onClick={() => setRenamed(true)}
				>
					Đổi tên users → members
				</Button>
				<Button
					variant="ghost"
					data-id="landing-live-sync-reset"
					onClick={() => setRenamed(false)}
				>
					Đặt lại
				</Button>
				<span aria-live="polite">
					<Badge tone={renamed ? "primary" : "success"}>
						{renamed ? "5 request đã cập nhật" : "Đã đồng bộ"}
					</Badge>
				</span>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<section
					data-id="landing-live-sync-mock"
					aria-label="Mock"
					className={CARD}
				>
					<h3 className={CARD_TITLE}>Mock · resource</h3>
					<code className="font-semibold text-primary">/{names.plural}</code>
					<p className="m-0 text-muted text-sm">
						Field: <code>id</code>, <code>name</code>, <code>email</code>
					</p>
				</section>
				<section
					data-id="landing-live-sync-collection"
					aria-label="Collection"
					className={CARD}
				>
					<h3 className={CARD_TITLE}>Collection · {requests.length} request</h3>
					<ul className="m-0 grid list-none gap-2 p-0 text-sm">
						{requests.map((request) => (
							<li key={request.method + request.path} className="flex gap-2">
								<Badge className="min-w-16 justify-center">
									{request.method}
								</Badge>
								<span className="min-w-0">
									<span className="block">{request.name}</span>
									<code className={cn("text-muted", renamed && "text-primary")}>
										{request.path}
									</code>
								</span>
							</li>
						))}
					</ul>
					<p className="m-0 text-[0.8125rem] text-muted">
						Header <code>X-Debug</code> bạn đã thêm vào “List {names.plural}”
						được giữ nguyên.
					</p>
				</section>
			</div>
		</LandingSection>
	);
}
