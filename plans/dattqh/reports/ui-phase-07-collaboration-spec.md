# Đặc tả UI phase 07: cộng tác viên, magic link và trang nhận lời mời

Đầu vào cho việc T4 (web). Nguồn: `prototype/index.html` (`openCollaborators` dòng 2475, `openMagicLink` 2459, `accountCardHTML` 2127, `inviteExpiry` 2128, `projectPeople` 1340, CSS `.collab-*` 650–658, `.account-match`/`.invite-actions` 758–761), `docs/design-system.md`, `apps/web/src/components/ui/*`, `project-actions-menu.tsx`.

Prototype **không có** trang `/invite/:token`, nên trang này đặc tả mới, dựng từ primitive sẵn có. Modal Magic link của prototype (link `/clone/…`, nhân bản project) đã lỗi thời. Bên dưới đặc tả lại theo ngữ nghĩa đã chốt và giữ bố cục `copy-row`.

## 0. Tái dùng và phần cần thêm

| Nhu cầu | Dùng | Ghi chú |
|---|---|---|
| Khung modal | `Modal` (`size="md"`), `ModalFooter`, `ModalClose` | Giống `openModal` của prototype: footer 2 cột |
| Xoá thành viên, thu hồi link, rời project | `ConfirmModal` | Focus nút Huỷ, lỗi hiện ngay trong modal |
| Ô nhập username/email | `FormField` + `Input` | Lỗi qua prop `error` (tự gắn `aria-describedby`/`aria-invalid`) |
| Gợi ý tài khoản khớp | `useDebouncedValue` (`lib/use-debounced-value.ts`) | Debounce 300ms, chỉ tra khi có ≥ 3 ký tự |
| Badge Owner/Đang chờ/Đã tham gia/email chưa xác minh | `Badge` tone `primary` / `warning` / `success` / `warning` | Badge là chữ, nên không phụ thuộc vào màu |
| Nút | `Button`, `IconButton` (X dùng `size="sm"`, lên 40px trên màn cảm ứng) | |
| Thông báo trạng thái | `Alert`, `EmptyState` (`headingLevel={1}` cho trang mời), `AuthStatus` | |
| Toast | `useToast` | Xem phần a11y: toast nằm ngoài dialog |
| CTA nâng cấp | `useSubscriptionDialogs().openPlans(reason)` | **Phải thêm** `LimitReason "members"` và nguồn `plan_limit_members` vào `PRO_INTEREST_SOURCES` (`packages/shared/src/pro-interest-schema.ts`) |
| Đăng nhập/đăng ký rồi quay lại | `LoginLink` với `returnTo`, `prompt="create"` | `loginUrl` đã chặn open redirect |
| Ngày `dd/mm/yyyy` | `formatDate` (`lib/format.ts`) | Thay `inviteExpiry()` |
| Avatar người | `avatarInitial`/`avatarGroup` (`project-avatar.tsx`) và quy tắc ảnh `https://` của `UserAvatar` | **Thêm** `features/collaborators/person-avatar.tsx`, cỡ 32px (`size-8 rounded-sm`), giống `.collab-item .avatar` |
| Ô link + nút copy | chưa có | **Thêm** `components/ui/copy-field.tsx`. Có 2 call-site thật (magic link và link mời 1 lần); gói clipboard, fallback, live region |

## 1. Mục menu ⋮ (`project-actions-menu.tsx`)

Thứ tự theo prototype `projectMenu` (dòng 2417):

| Mục | Icon Tabler | `data-id` | Owner | Collaborator |
|---|---|---|---|---|
| Cộng tác viên | `IconUsers` | `project-menu-collaborators` | có, quản lý | có, chỉ xem và nút "Rời project" |
| Magic link | `IconLink` | `project-menu-magic-link` | có | ẩn |
| Nhân bản | `IconCopy` | `project-menu-clone` | có | có |
| Sửa | `IconPencil` | `project-menu-edit` | có | ẩn |
| (separator) và Xoá | `IconTrash` | `project-menu-delete` | có | ẩn |

- Mở rộng `ProjectAction` thành `"collaborators" | "magic-link" | "clone" | "edit" | "delete"`.
- Sửa doc comment của component: "Collaborators can only clone…" không còn đúng.

## 2. Modal Cộng tác viên

`Modal` md, `data-id="modal-collaborators"`, tiêu đề `Cộng tác viên · {project.name}`. Footer theo prototype: `Đóng` | `Xong` (cả hai đều đóng modal). Riêng collaborator có footer khác, xem 2.4.

### 2.1 Cấu trúc (owner)

| Thứ tự | Phần tử | Chữ | `data-id` |
|---|---|---|---|
| 1 | Dòng đếm (`.gate`, chữ mono `text-muted`) | `{n}/{cap} thành viên (tính cả owner và lời mời đang chờ)` | `modal-collaborators-count` |
| 1b | Khối đầy (chỉ khi `n ≥ cap`) | xem 2.3 | `modal-collaborators-full`, `modal-collaborators-plans` |
| 2 | `<fieldset>` (legend sr-only "Mời cộng tác viên"), `disabled` khi đầy | | |
| 2a | `FormField` label `Username hoặc email` + `Input` placeholder `@username hoặc ten@example.com`, `autocomplete="off"`, cùng hàng với nút `Mời` (`IconPlus`, primary) | | `modal-collaborators-email`, `modal-collaborators-invite` |
| 2b | Vùng gợi ý (`aria-live="polite"`) | thẻ tài khoản khớp hoặc dòng không khớp | `invite-match-{username}`, `invite-match-unverified`, `modal-collaborators-no-match` |
| 2c | `.invite-actions`: nút secondary sm `IconLink` `Copy link mời (dùng 1 lần, 7 ngày)` + help `Cho người chưa có tài khoản hoandat.` | | `modal-collaborators-invite-link` |
| 2d | Link vừa tạo (`CopyField`, chỉ hiện ngay sau khi tạo) | label `Link mời cho {email}`, help `Hết hạn {dd/mm/yyyy}. Link chỉ hiện lần này.` | `modal-collaborators-link`, `modal-collaborators-link-copy` |
| 3 | `<ul aria-label="Danh sách cộng tác viên">` | các dòng ở 2.2 | `collaborator-*` |

Thẻ tài khoản khớp (`accountCardHTML`): avatar, **Tên** · @username, xuống dòng là email (help). Nếu chưa xác minh thì thêm badge warning `email chưa xác minh`. Viền primary 35% (`.account-match`).

**Đính chính so với prototype:**
- Nút "Copy link mời" của prototype tạo link không gắn email.
- Theo điều kiện accept của phase 07 (link token, cộng với tài khoản đã gắn sẵn hoặc email Google/GitHub đã xác minh trùng khớp), link không gắn email thì không ai accept được.
- Vì vậy nút chỉ bật khi ô nhập là **email hợp lệ và không khớp tài khoản nào**. Khi đó gọi `POST /api/collaborators {usernameOrEmail: email}`.
- Khi đang tắt, help đổi thành `Nhập email của người chưa có tài khoản để tạo link mời.`

### 2.2 Dòng danh sách (`collaborator-row.tsx`)

Bố cục `.collab-item`: viền `border-subtle`, bo `radius-md`, `gap-3`, padding `py-2 pr-2 pl-3`. Nhãn dùng chữ mono 13px, cắt bằng ellipsis.

| State | Avatar | Nhãn | Badge | Hành động | `data-id` |
|---|---|---|---|---|---|
| Owner | ảnh hoặc chữ cái đầu | `{name} · @{username}` (thiếu thì dùng email) | primary `Owner` | — | `collaborator-owner` |
| Accepted | ảnh hoặc chữ cái đầu | `{name} · @{username}` | success `Đã tham gia` | X, `aria-label="Xoá {nhãn} khỏi project"` rồi mở `ConfirmModal` | `collaborator-{username}`, `collaborator-{username}-remove` |
| Pending (theo tài khoản) | như trên | như trên, kèm warning `email chưa xác minh` nếu có | warning `Đang chờ` | X, `aria-label="Huỷ lời mời {nhãn}"`, huỷ ngay (không cần confirm) + toast | như trên |
| Pending (link 1 lần theo email) | ô `IconLink` tone neutral (`av-6`) | `Link mời · {email} · hết hạn {dd/mm/yyyy}` | warning `Đang chờ` | X `Huỷ lời mời …` | `collaborator-link-{id}`, `collaborator-link-{id}-remove` |
| Hết hạn (nếu API vẫn trả về) | như pending | `… · đã hết hạn {dd/mm/yyyy}` | neutral `Hết hạn` | X `Xoá lời mời …` | như pending |
| Chính mình (góc nhìn collaborator) | | `{name} · @{username}` | success `Đã tham gia` + neutral `Bạn` | — | `collaborator-{username}` |

Xoá thành viên đã tham gia cần `ConfirmModal` (`data-id="modal-remove-collaborator"`):
- Câu hỏi: `Xoá {name} khỏi {project}?`
- Nội dung: `Họ sẽ mất quyền truy cập project ngay.`
- Nút xác nhận: `Xoá khỏi project`

Prototype xoá ngay không hỏi. Ở đây thêm bước xác nhận vì đây là thao tác tước quyền và không hoàn tác được.

### 2.3 State của modal

| State | Hiển thị |
|---|---|
| Đang tải | Dòng đếm hiện `…`. Fieldset `disabled`. `<ul aria-busy="true">` chứa `<output data-id="modal-collaborators-loading">Đang tải thành viên…</output>` |
| Lỗi tải | `Alert` danger `Không tải được danh sách thành viên` kèm `errorMessage(error)` + `Button` `Thử lại` (`modal-collaborators-error`, `modal-collaborators-retry`). Ẩn form |
| Gõ < 3 ký tự | Vùng gợi ý rỗng |
| Khớp tài khoản | Thẻ tài khoản (2.1). Nút `Mời` bật |
| Khớp tài khoản có email chưa xác minh | Thẻ + badge `email chưa xác minh` (`invite-match-unverified`). Vẫn mời được, vì lời mời gắn với `inviteeUserId` |
| Không khớp | `Chưa có tài khoản khớp. Dùng “Copy link mời” để mời người chưa có tài khoản.` Nút link mời chỉ bật nếu ô nhập là email |
| Submit không khớp (username) | Lỗi field: `Không tìm thấy tài khoản với username hoặc email này.` |
| Trùng thành viên hoặc owner | Lỗi field: `Người này đã có trong project.` |
| Đang gửi | Nút `Đang mời…` / `Đang tạo link…`, `disabled` |
| Mời thành công (tài khoản) | Dòng mới trượt vào (mục 5). Xoá ô nhập. Toast `Đã mời {name}` với mô tả `Họ thấy lời mời trong app và qua kênh thông báo đã bật.` Trả focus về ô nhập |
| Tạo link 1 lần thành công | Dòng link mới trượt vào. `CopyField` (2d) hiện link, tự sao chép một lần. Thông báo copy (mục 7) |
| Đầy, gói Free | `.gate`: badge accent `IconLock` `Đã đủ 3 thành viên`, help `Thành viên thứ 4 cần gói Pro.`, `Button` secondary sm `Xem gói` → `openPlans("members")`. Fieldset `disabled` |
| Đầy, gói Pro (10/10) | Badge `Đã đủ 10 thành viên`, help `Xoá bớt thành viên hoặc lời mời để mời thêm.`, không có CTA |
| Server trả 403 `PLAN_LIMIT_REACHED` (đua) | Tải lại danh sách, khoá fieldset, mở `openPlans("members")` nếu là Free |
| Lỗi khác khi mời | Lỗi field `errorMessage(error)` |

`cap` lấy từ `limitsFor(ownerPlan).membersPerWorkspace` (API trả hoặc shared). `n` = 1 (owner) + accepted + pending chưa hết hạn.

### 2.4 Góc nhìn collaborator

- Không có fieldset mời, không có khối đầy, không có nút X.
- Danh sách chỉ gồm owner và thành viên đã tham gia, không lộ email của lời mời đang chờ. Dòng đếm vẫn hiện.
- Footer: `Button` danger-ghost (variant `ghost`, chữ `text-error`) `Rời project` (`modal-collaborators-leave`) | `Đóng`.
- `Rời project` mở `ConfirmModal` (`data-id="modal-leave-project"`):
  - Câu hỏi: `Rời {project}?`
  - Nội dung: `Bạn sẽ mất quyền truy cập cho tới khi được mời lại.`
  - Nút: `Rời project`
  - Thành công thì đóng cả hai modal, toast `Đã rời {project}`, về `/projects` (nếu đang ở trang chi tiết) hoặc bỏ dòng khỏi danh sách.

## 3. Modal Magic link (đặc tả lại)

`Modal` md, `data-id="modal-magic-link"`, tiêu đề `Magic link · {project.name}`. Chỉ owner thấy. Mỗi project có tối đa một link đang hoạt động; tạo link mới sẽ thu hồi link cũ.

Mô tả (`text-muted`, luôn hiện):
> Ai đã đăng nhập và mở link này sẽ tham gia **{project}** với vai trò cộng tác viên. Link dùng được nhiều lần, hết hạn sau 7 ngày. Bạn có thể tạo link mới hoặc thu hồi bất cứ lúc nào.

| State | Thân modal | Footer | `data-id` |
|---|---|---|---|
| Đang tải | `<output>Đang tải trạng thái link…</output>` | `Đóng` | `modal-magic-link-loading` |
| Chưa có hoặc đã thu hồi | help `Chưa có magic link đang hoạt động.` | `Đóng` \| primary `IconLink` `Tạo magic link` | `modal-magic-link-create` |
| **Vừa tạo** (token chỉ có ở đây) | `copy-row` như prototype: `CopyField` input readonly (label sr-only `Magic link`, chọn hết khi focus) + `IconButton` secondary `IconCopy` `aria-label="Sao chép link"`. Dưới đó: `Alert` warning `Link chỉ hiện lần này. Hãy sao chép trước khi đóng.` + help `Hết hạn {dd/mm/yyyy}.` | `Đóng` \| primary `IconCopy` `Sao chép link` | `modal-magic-link-input`, `modal-magic-link-copy`, `modal-magic-link-expiry` |
| Đang hoạt động (mở lại sau) | Thẻ trạng thái (viền `border-subtle`, bo md): badge success `Đang hoạt động` · `Hết hạn {dd/mm/yyyy}` · `Tạo lúc {dd/mm/yyyy}`. Help `Vì lý do bảo mật, link không hiển thị lại. Tạo link mới nếu cần gửi lại.` Nút ghost chữ error `Thu hồi` | `Đóng` \| secondary `Tạo link mới` | `modal-magic-link-status`, `modal-magic-link-revoke`, `modal-magic-link-regenerate` |
| Hết hạn | Thẻ trạng thái: badge neutral `Đã hết hạn` · `Hết hạn {dd/mm/yyyy}` | `Đóng` \| primary `Tạo link mới` | `modal-magic-link-status`, `modal-magic-link-regenerate` |
| Đầy thành viên | Thêm `Alert` warning `Project đã đủ {n}/{cap} thành viên. Người mở link sẽ không tham gia được cho tới khi bạn xoá bớt thành viên.` Với Free, thêm nút `Xem gói`. Vẫn cho tạo link | như state tương ứng | `modal-magic-link-full`, `modal-magic-link-plans` |
| Lỗi tải hoặc tạo | `Alert` danger + `Thử lại` | `Đóng` | `modal-magic-link-error`, `modal-magic-link-retry` |
| Đang tạo | Nút `Đang tạo…` disabled | | |

Xác nhận:
- **Tạo link mới** khi đang có link hoạt động: `ConfirmModal` `data-id="modal-regenerate-magic-link"`. Câu hỏi `Tạo magic link mới?`, nội dung `Link cũ ngừng hoạt động ngay. Người đã tham gia vẫn giữ quyền.`, nút `Tạo link mới`.
- **Thu hồi**: `ConfirmModal` `data-id="modal-revoke-magic-link"`. Câu hỏi `Thu hồi magic link?`, nội dung `Người mở link sẽ không tham gia được nữa. Người đã tham gia vẫn giữ quyền.`, nút `Thu hồi`. Xong thì chuyển về state "Chưa có", toast `Đã thu hồi magic link`.

## 4. Trang `/invite/:token` (`accept-invite-page.tsx`)

Route nằm dưới `AppLayout` (topbar công khai), **không** đặt trong `AppShell`. Lý do: `RequireAuth` tự chuyển sang IdP và mất lựa chọn "Đăng ký". Trang tự đọc `useCurrentUser()`.

Bố cục: một `Card` `max-w-md mx-auto p-6`, `data-id="invite-page"`, `grid gap-4`, căn giữa. Các state lỗi dùng `EmptyState headingLevel={1}`. Dùng chung cho link mời 1 lần và magic link; API preview cho biết loại.

| State | Nội dung | Hành động | `data-id` |
|---|---|---|---|
| Kiểm tra phiên | `AuthStatus kind="loading"` | — | `auth-loading` |
| Chưa đăng nhập | Icon `IconUsers`. h1 `Bạn được mời tham gia một project trên Localman`. Text `Đăng nhập hoặc tạo tài khoản hoandat để xem lời mời. Xong bạn sẽ quay lại trang này.` **Chưa gọi API preview** để không lộ tên project trước khi đăng nhập | `LoginLink` primary block `Đăng nhập` (`returnTo=/invite/:token`). `LoginLink` secondary block `Đăng ký` (`prompt="create"`, cùng `returnTo`) | `invite-page-login`, `invite-page-signup` |
| Đang tải preview | `<output>Đang kiểm tra lời mời…</output>` | — | `invite-page-loading` |
| Hợp lệ | Avatar project (`ProjectAvatar`). h1 `Tham gia {project}`. `{inviterName} (@{username}) mời bạn cộng tác.` Help `Hết hạn {dd/mm/yyyy}` (magic link: `Link dùng chung · hết hạn …`). Hàng tài khoản: `UserAvatar` + `Bạn đang đăng nhập bằng {email}` | primary block `Tham gia` (busy `Đang tham gia…`). Link phụ `Đăng nhập tài khoản khác`. Ghost `Về Projects` | `invite-page-project`, `invite-page-inviter`, `invite-page-expiry`, `invite-page-account`, `invite-page-accept`, `invite-page-switch-account`, `invite-page-back` |
| Tham gia xong | `navigate("/projects/:id", {replace:true})` + toast `Đã tham gia {project}` | — | — |
| Hết hạn | `EmptyState` icon `IconLinkOff`, title `Link mời đã hết hạn`, text `Link hết hạn ngày {dd/mm/yyyy}. Nhờ người mời gửi link mới.` | `Về Projects` | `invite-page-invalid`, `invite-page-back` |
| Đã dùng (link 1 lần) | title `Link mời đã được dùng`, text `Mỗi link mời chỉ dùng được một lần. Nhờ người mời gửi link mới.` | như trên | như trên |
| Thu hồi hoặc không tồn tại | title `Link mời không còn hiệu lực`, text `Chủ project đã thu hồi link này hoặc link không đúng.` | như trên | như trên |
| Không đủ điều kiện (403) | `Alert` warning title `Tài khoản này không nhận được lời mời`. Text: `Lời mời gửi cho {email đã che, vd t***@example.com}. Hãy đăng nhập bằng tài khoản được mời, hoặc liên kết Google/GitHub có email đã xác minh trùng với email này.` Nếu preview đã báo không đủ điều kiện thì ẩn nút `Tham gia` | `Đăng nhập tài khoản khác` (primary), `Về Projects` | `invite-page-ineligible`, `invite-page-switch-account` |
| Project đầy (403 `PLAN_LIMIT_REACHED` khi accept) | `Alert` warning `Project đã đủ thành viên theo gói của chủ project. Nhờ chủ project xoá bớt thành viên.` Không có CTA nâng cấp, vì người nhận không nâng gói của owner được | `Về Projects` | `invite-page-full` |
| Đã là thành viên hoặc là owner | `Alert` info `Bạn đã là thành viên của {project}.` | primary `Mở project` → `/projects/:id` | `invite-page-member`, `invite-page-open-project` |
| Lỗi mạng hoặc lỗi khác | `Alert` danger `errorMessage` | `Thử lại` | `invite-page-error`, `invite-page-retry` |

"Đăng nhập tài khoản khác" = đi qua `logoutUrl()` rồi đăng nhập lại với `returnTo` là trang mời. Cần backend logout nhận `returnTo` (xem câu hỏi).

## 5. Animation thêm/xoá dòng

- Mỗi `<li>` bọc một `grid` có `grid-template-rows` chạy `0fr → 1fr`, kèm `opacity 0 → 1` và `translateY(-4px) → 0`.
  - `transition: grid-template-rows, opacity, transform` với `var(--dur-base)` (200ms) và `var(--ease-decelerate)` khi vào, `var(--ease-accelerate)` khi ra.
  - Khi thu gọn, phần tử con cần `min-h-0 overflow-hidden`.
- **Vào:** dùng variant `starting:` của Tailwind 4 (`@starting-style`) cho `opacity-0 -translate-y-1 grid-rows-[0fr]`. Không cần JS. Dòng chỉ được thêm sau khi server trả thành công.
- **Ra:** sau khi DELETE thành công, đặt `data-state="leaving"` (trở về `0fr`, `opacity-0`). Gỡ khỏi state ở `onTransitionEnd`, có `setTimeout(250ms)` dự phòng.
- **Reduced motion:** token đã đưa mọi duration về 1ms. Thêm `motion-reduce:transition-none` trên dòng để chắc chắn, timeout dự phòng vẫn gỡ dòng.
- **Focus sau khi xoá:** chuyển sang nút X của dòng kế tiếp, không có thì về ô nhập (owner) hoặc nút `Đóng`. Không để focus rơi về `body`.

## 6. Responsive

| Viewport | Modal | Dòng thành viên | Trang mời |
|---|---|---|---|
| 375 | Rộng 100% trừ `gutter`. Ô nhập và `Mời` cùng một hàng (`.collab-invite`, input `min-w-0`). `.invite-actions` xuống dòng (help dưới nút). `copy-row` giữ một hàng | Grid `[avatar][nhãn][X]`. Badge xuống dòng 2 dưới nhãn (`col-start-2`). Nhãn được xuống dòng (`white-space: normal` như `.account-match`). X ≥ 40px (`pointer-coarse`) | Card full width, nút block xếp dọc |
| 768 | `max-w-md` (448px) căn giữa | Một hàng: badge nằm trước X (`.collab-email` dùng `flex 1 1 160px`) | Card `max-w-md`, `py-16` |
| 1440 | Như 768 | Như 768 | Như 768 |

Thân modal cuộn khi danh sách dài (`Modal` đã có `overflow-y-auto`); footer dính đáy.

## 7. A11y

- **Focus khi mở:**
  - Owner, modal Cộng tác viên: `initialFocusRef` là ô nhập.
  - Collaborator: nút `Đóng`.
  - Magic link: nút `Tạo magic link`. Ngay sau khi tạo, chuyển focus sang nút copy.
  - `ConfirmModal`: nút Huỷ (đã có sẵn).
- **Copy:**
  - Radix Dialog đặt `aria-hidden` lên mọi thứ ngoài dialog, nên toast có thể không được đọc khi modal mở.
  - Vì vậy `CopyField` có `<span role="status" aria-live="polite" class="sr-only">` riêng bên trong modal, đọc `Đã sao chép link`. Nút copy đổi icon sang `IconCheck` và `aria-label="Đã sao chép"` trong 2 giây.
  - Clipboard lỗi: chọn sẵn chữ trong input và báo `Không sao chép được, hãy chọn và sao chép thủ công.`
- **Gợi ý tài khoản** nằm trong vùng `aria-live="polite"` như prototype. Debounce để không đọc theo từng phím.
- **Lỗi field** đi qua `FormField error`. Lỗi tải hoặc lỗi accept dùng `Alert` (danger/warning là `role="alert"`).
- **Danh sách:** `aria-busy` khi đang tải. Nhãn của nút X ghi rõ tên người. Badge là chữ thật (không chỉ màu).
- **Fieldset khi đầy:** `disabled`, legend sr-only. Lý do (`modal-collaborators-full`) nằm ngay trên fieldset nên đọc được trước.
- **Trang mời:** mỗi state có đúng một `h1`. Khi chuyển state, focus vào `h1` (`tabIndex={-1}`). Mọi vùng chạm ≥ 44px.

## 8. Mapping prototype và thay đổi

| Prototype | Spec |
|---|---|
| Đếm "tính cả owner, lời mời và link mời đang chờ" | "tính cả owner và lời mời đang chờ". Magic link dùng lại được nên không giữ chỗ |
| "Copy link mời" không gắn email | Chỉ bật khi ô nhập là email chưa có tài khoản, và link gắn với email đó |
| Xoá thành viên không hỏi | Accepted thì hỏi bằng `ConfirmModal`, pending thì huỷ ngay |
| Magic link nhân bản project (`/clone/…`) | Link mời dùng lại được, 7 ngày, token chỉ hiện một lần, có tạo mới và thu hồi |
| Không có trang mời | Mục 4 |
| Không có góc nhìn collaborator | Mục 2.4 |

## Câu hỏi còn mở

1. Magic link có giữ chỗ trong trần thành viên không? Spec giả định **không**: chỉ chặn lúc accept (403 `PLAN_LIMIT_REACHED`).
2. API preview `GET /api/invites/:token` cần trả những gì: loại link, tên project, người mời, hạn, `eligible` + lý do, email đã che. Cần phân biệt mã lỗi (`INVITE_EXPIRED`/`INVITE_USED`/`INVITE_REVOKED`/`INVITE_NOT_FOUND`), nếu không thì UI chỉ hiện được thông báo chung. Phase 07 chưa liệt kê endpoint này, T2/T3 cần thêm.
3. Lời mời hết hạn: backend ẩn đi hay trả về với trạng thái `expired`? Không tính vào trần trong cả hai cách.
4. `/auth/logout` có nhận `returnTo` cho nút "Đăng nhập tài khoản khác" không?
5. Prototype hiện "· N cộng tác viên" trong meta của dòng project (dòng 2349). Có làm trong phase 07 không? Nếu làm thì cần thêm field vào `Project`.

Status: DONE_WITH_CONCERNS
Summary: Đã đặc tả modal Cộng tác viên, modal Magic link (theo ngữ nghĩa link mời dùng lại được), trang /invite/:token và menu ⋮, gồm chữ, primitive, data-id, mọi state, animation 200ms, responsive, a11y.
Concerns: Prototype có "Copy link mời" không gắn email, không thoả được điều kiện accept, nên spec đổi thành gắn email. Cần thêm LimitReason "members", nguồn `plan_limit_members`, endpoint preview lời mời và mã lỗi phân biệt; xem 5 câu hỏi mở.
