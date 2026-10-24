/**
 * Parts of Vietnamese fake job titles, "role department" as titles are
 * written in Vietnam ("Trưởng phòng Kế toán", "Nhân viên Kinh doanh").
 * Used by the `vi` Faker of Vietnamese-named fields (`chuc_vu`,
 * `nghe_nghiep`), whose own `vi` locale has no jobs and falls back to
 * English ("Dynamic Directives Associate").
 */

/** Roles, from entry level to management. */
export const VN_JOB_ROLES: readonly string[] = [
	"Nhân viên",
	"Chuyên viên",
	"Thực tập sinh",
	"Trưởng nhóm",
	"Phó phòng",
	"Trưởng phòng",
	"Phó giám đốc",
	"Giám đốc",
];

/** Departments; every one reads well after every role. */
export const VN_JOB_DEPARTMENTS: readonly string[] = [
	"Kinh doanh",
	"Kế toán",
	"Tài chính",
	"Nhân sự",
	"Hành chính",
	"Tiếp thị",
	"Truyền thông",
	"Kỹ thuật",
	"Công nghệ thông tin",
	"Chăm sóc khách hàng",
	"Pháp chế",
	"Mua hàng",
	"Kho vận",
	"Sản xuất",
	"Chất lượng",
	"Dự án",
];

/** Level words, for `name.jobDescriptor` on a Vietnamese field. */
export const VN_JOB_LEVELS: readonly string[] = [
	"Cấp cao",
	"Chính",
	"Tập sự",
	"Phụ trách",
];
