import { Wordmark } from "../../components/brand/wordmark";
import { ButtonShowcase } from "./button-showcase";
import { FeedbackShowcase } from "./feedback-showcase";
import { FormShowcase } from "./form-showcase";
import { OverlayShowcase } from "./overlay-showcase";

/** Reference page for comparing the UI primitives with the prototype. */
export function PrimitivesPage() {
	return (
		<article data-id="primitives" className="grid gap-6">
			<header className="grid gap-2">
				<p className="m-0 font-mono font-semibold text-primary text-xs uppercase tracking-[0.12em]">
					Design system
				</p>
				<h1 className="m-0 font-bold text-3xl tracking-[-0.02em]">
					Primitive của <Wordmark className="text-3xl" />
				</h1>
				<p className="m-0 max-w-160 text-muted">
					Trang đối chiếu các thành phần giao diện dùng chung với prototype. Đổi
					chế độ sáng/tối ở góc phải để kiểm tra cả hai theme.
				</p>
			</header>
			<ButtonShowcase />
			<FormShowcase />
			<FeedbackShowcase />
			<OverlayShowcase />
		</article>
	);
}
