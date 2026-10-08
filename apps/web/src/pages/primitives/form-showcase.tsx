import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { ShowcaseSection } from "./showcase-section";

export function FormShowcase() {
	return (
		<ShowcaseSection
			dataId="primitives-forms"
			title="Biểu mẫu"
			description="Nhãn liên kết với ô nhập; lỗi được đọc bởi trình đọc màn hình."
		>
			<div className="grid gap-4 md:grid-cols-2">
				<FormField
					label="Tên project"
					hint="Chữ thường, số và dấu gạch ngang."
					required
				>
					<Input
						placeholder="vd: cua-hang-demo"
						data-id="primitives-forms-name"
					/>
				</FormField>
				<FormField label="Endpoint" error="Endpoint đã tồn tại trong project.">
					<Input defaultValue="/users" data-id="primitives-forms-endpoint" />
				</FormField>
				<FormField label="Phương thức">
					<Select defaultValue="GET" data-id="primitives-forms-method">
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="PUT">PUT</option>
						<option value="DELETE">DELETE</option>
					</Select>
				</FormField>
				<FormField label="Ô bị khoá">
					<Input disabled defaultValue="Không chỉnh được" />
				</FormField>
				<FormField label="Ghi chú" className="md:col-span-2">
					<Textarea
						placeholder="Mô tả ngắn cho resource này"
						data-id="primitives-forms-note"
					/>
				</FormField>
			</div>
		</ShowcaseSection>
	);
}
