# Chunks-LMS System Ontology & Domain Specifications

**Version:** 1.2.0
**Status:** CANONICAL DOMAIN ONTOLOGY (Single Source of Truth)  
**Companion Visual File:** `docs/architecture/ontology.html`  
**Governing PRD:** `docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md`

> **BẮT BUỘC ĐỐI VỚI TẤT CẢ AGENT & DEVELOPER:**
> Trước khi viết, sửa code hoặc thực hiện review (dù bằng tay hay qua SSSF pipeline), BẮT BUỘC phải đọc file này. Mọi thay đổi về cấu trúc dữ liệu, ranh giới quyền truy cập hoặc logic đồng bộ đều phải được đối chiếu và cập nhật đồng thời tại file này và file `ontology.html`.

---

## 1. Bản đồ Thực thể & Định danh (Entities & Identity)

```text
[Organization (Anchor)]
       │
       ├── owns 1..N ──> [Course / Program]
       │                        │
       │                   defines 1..N
       │                        │
       │                        ▼
       ├── owns 1..N ──> [Class] <── assigned to ── [Teacher (User)]
       │                   │
       │              contains 1..N
       │                   │
       │                   ▼
       ├── owns 1..N ──> [Enrollment] ── references ──> [Learner (User)]
       │                   │
       │             participates in
       │                   │
       │                   ▼
       └── owns 1..N ──> [Learning Session]
                           │
                      records 1..N
                           │
                           ▼
                    [Assessment Attempt] ──> [Immutable Events & Finalized Results]
```

### 1.1. Chi tiết Thực thể Cốt lõi

| Thực thể (Entity) | Bảng DB | TypeScript Type | Chủ sở hữu (Owner) | Mô tả & Ranh giới |
|---|---|---|---|---|
| **Organization** | `organizations` | `Organization` | Hệ thống | Cố định ở 1 tổ chức duy nhất (`LOCAL_ORG_ID`). Là anchor khóa ngoại cho toàn bộ dữ liệu, không có logic chuyển đổi trường. |
| **User** | `users` | `DomainUser` | Organization | Cá nhân trong hệ thống. Định danh ổn định dạng UUID. Phân biệt qua `roles: ('admin' \| 'teacher' \| 'learner')[]`. |
| **Staff Role** | `staff_roles` | `StaffRole` | User | Quyền truy cập nội bộ (`admin` hoặc `teacher`). Liên kết với `auth.users.id`. |
| **Workspace Revision** | `organization_workspace_versions` | `workspaceRevision` (AppState) | Organization | Bộ đếm OCC theo tổ chức. `get_workspace_snapshot` trả revision hiện tại; `sync_workspace_atomic` khóa hàng, kiểm tra revision và tăng bộ đếm sau khi ghi thành công. |
| **Course** | `courses` | `Course` | Teacher/Org | Khung chương trình học tập (ví dụ: Chunks Foundation, 15 buổi). |
| **Class** | `classes` | `Class` | **Teacher** | Lớp học cụ thể. **Bắt buộc** có `teacher_user_id` chỉ định giáo viên phụ trách duy nhất. |
| **Enrollment** | `enrollments` | `Enrollment` | Class + Learner | Quan hệ ghi danh học viên vào lớp. Giới hạn bởi `classes.capacity`. |
| **Learning Session** | `learning_sessions`| `LearningSession`| **Teacher** | Buổi học/buổi kiểm tra diễn ra trên thực tế. Mang cờ `sessionKind: 'regular' \| 'pretest' \| 'posttest'`. |
| **Session Question** | `session_questions`| `SessionQuestion`| Learning Session | Câu hỏi hoặc nhịp quan sát trong phiên học. |
| **Assessment Attempt**| `assessment_attempts`| `AssessmentAttempt`| Session + Learner | Phiên chấm điểm của 1 học viên cho 1 câu hỏi. |
| **Assessment Event** | `assessment_events`| `AssessmentEvent` | Attempt | Nhật ký sự kiện chấm điểm bất biến (append-only stream). |
| **Attempt Snapshot** | `assessment_attempt_snapshots` | `AttemptSnapshot` | Attempt | Trạng thái hiện tại phục vụ hiển thị UI và realtime. |
| **Test Package** | `test_packages` | `TestPackage` | Admin | Bộ bài kiểm tra chuẩn (ví dụ: 49 câu, 21 câu mini-test). |
| **Test Section** | `test_sections` | `TestSection` | Test Package Version | Một phần trong bài kiểm tra (chuẩn gồm 7 sections). |
| **Test Item** | `test_items` | `TestItem` | Test Section | Câu hỏi kiểm tra cụ thể kèm audio và kịch bản đọc. |

---

## 2. Ma trận Phân quyền & Cô lập Dữ liệu (Ownership & Access Matrix)

Hệ thống tuân thủ nguyên tắc: **Cùng 1 Tổ chức nhưng dữ liệu được cô lập chặt chẽ theo vai trò (Role-Scoped Isolation).**

| Dữ liệu | Quyền Hạn của Teacher | Quyền Hạn của Admin |
|---|---|---|
| **Lớp học (Classes)** | **CHỈ XEM & SỬA** các lớp do chính mình phụ trách (`classes.teacher_user_id = current_user.id`). Không nhìn thấy lớp của giáo viên khác. | **TOÀN QUYỀN:** Xem, tạo, sửa, đổi giáo viên cho tất cả các lớp trong trường. |
| **Học viên (Learners)** | **CHỈ XEM & THAO TÁC** học viên đang ghi danh vào các lớp của mình (`enrollments.class_id IN (teacher_classes)`). Khi tạo học viên mới, bắt buộc gán vào 1 lớp của mình. | **TOÀN QUYỀN:** Xem danh sách toàn trường, tạo học viên độc lập, chuyển lớp giữa các giáo viên. |
| **Ca học (Sessions)** | **CHỈ QUẢN LÝ** ca học thuộc các lớp của mình. Chấm điểm trực tiếp (Observe) học viên của mình. | **TOÀN QUYỀN:** Xem bảng vận hành toàn trường (Ops board), xem lại lịch sử phiên học của mọi giáo viên. |
| **Kết quả & Điểm số** | Xem báo cáo tiến độ (`TeacherAnalysisPage`) của các lớp mình dạy. | Xem báo cáo tổng hợp cấp trường (`AdminAnalysisPage`) và nhật ký kiểm toán (`AdminAuditPage`). |
| **Tài khoản Staff** | Không có quyền truy cập. | Quản lý active/inactive tài khoản Teacher và Admin (`AdminPeoplePage`). |
| **Cấu hình Bài test & Audio** | Đọc danh mục bài test để giao bài và chạy bài test cho học sinh (`TeacherTestsPage`). | Tạo mới, sửa nội dung câu hỏi, duyệt và sinh file âm thanh TTS (`AdminPackageTestsPage`, `AdminTestAudioPage`). |

---

## 3. Các Bất Biến của Hệ Thống (System Invariants)

1. **Bất biến Bất khả xâm phạm về Dữ liệu Điểm số (Assessment Immutability):**
   * Mọi can thiệp bằng probe (`enteredProbeFlow = true`, tăng `probeCount`) và mọi màu chấm (`SPECTRUM_COLORS`) một khi đã finalize đều không được phép ghi đè vật lý (DELETE/UPDATE). Mọi sửa đổi sau khi finalize bắt buộc phải ghi thành bản ghi hiệu chỉnh (`result_corrections` / `OpsAuditEvent`).
2. **Bất biến Sĩ số Lớp học (Capacity Constraint):**
   * Số lượng bản ghi `enrollments` có trạng thái `active` của một lớp học không bao giờ được vượt quá `classes.capacity`.
   * Trigger kiểm tra sĩ số phải hỗ trợ giao dịch hoán đổi (atomic swap) mà không bắn lỗi giữa chừng.
3. **Bất biến Phiên bản Lạc quan (Optimistic Concurrency Control):**
   * Khi snapshot RPC trả revision, client lưu nó trong `workspaceRevision` và gửi lại dưới dạng `p_expected_revision`. `sync_workspace_atomic` từ chối một revision cũ hơn revision hiện tại bằng `CONFLICT_REVISION_MISMATCH`; client hiển thị trạng thái lỗi và yêu cầu reload thay vì tự ghi đè.
   * RPC là đường ghi ưu tiên. REST waterfall cũ vẫn là đường tương thích khi RPC không khả dụng; đường fallback không trả revision mới và không có bảo đảm OCC/transaction của RPC.
4. **Bất biến Định danh Giáo viên (Class Teacher Integrity):**
   * Một lớp học bắt buộc phải gắn liền với một giáo viên phụ trách (`teacher_user_id IS NOT NULL`).

---

## 4. Chu trình Đồng bộ Dữ liệu Nguyên tử và Snapshot Theo Vai trò

```text
[Boot / Reload]
       │
       ▼
[RPC get_workspace_snapshot]
       ├── Admin: toàn bộ workspace trong organization
       └── Teacher: lớp mình phụ trách + learners/enrollments/sessions liên quan
       │
       ▼
[AppState nhận data + revision]
       ├── Cloud không rỗng: cloud roster thắng browser cache cũ
       └── Scheduling: hợp nhất để giữ các session đang mở

[Client Mutation]
       │ (normalized roster + scheduling + expected revision nếu đã biết)
       ▼
[RPC sync_workspace_atomic]
       │ khóa organization_workspace_versions
       ├── expected < current ──> CONFLICT_REVISION_MISMATCH, không ghi
       └── hợp lệ ──> upsert dữ liệu trong 1 transaction ──> revision + 1
       │
       ▼
[AppState lưu newRevision]
```

### 4.1. Snapshot đọc có scope

- `get_workspace_snapshot(p_organization_id)` yêu cầu staff authentication.
- Admin nhận courses, classes, enrollments, users, scheduled sessions, learning sessions và attendance của tổ chức.
- Teacher chỉ nhận courses có lớp mình phụ trách, chính các lớp đó, enrollments và learners của các lớp đó, hồ sơ của chính mình, cùng scheduled/learning sessions và attendance thuộc các lớp đó.
- `TeacherOverviewPage` áp dụng lớp bảo vệ UI bổ sung: Teacher chỉ thấy learners có enrollment trong `options` lớp có thể thao tác; Admin vẫn giữ hành vi xem toàn trường và learners chưa gán lớp.

### 4.2. Ghi RPC-first và OCC

- `saveWorkspaceToSupabase` gọi `sync_workspace_atomic` trước đường REST cũ. Payload gồm roster và scheduling đã normalize cùng `p_expected_revision`.
- RPC upsert users/memberships, courses, classes, enrollments, scheduled sessions và learning sessions trong một PostgreSQL transaction. Với Teacher, class rows không thuộc actor và enrollment/session rows không thuộc lớp của actor bị bỏ qua.
- Khi thành công, RPC tăng `organization_workspace_versions.revision`; `AppState` giữ `newRevision` cho lần ghi sau. Khi conflict, debounced sync hiển thị thông báo reload; explicit `syncNow` trả thất bại qua error path.
- Nếu RPC bị thiếu, lỗi transport hoặc không trả payload khả dụng, client rơi về REST waterfall hiện có để tương thích migration. Fallback không được mô tả như atomic và không có OCC revision.
- Migration hiện nhận trường `attendance` trong payload phía client nhưng `sync_workspace_atomic` chưa xử lý mảng này; persistence attendance vẫn nằm ngoài phần upsert của RPC.

### 4.3. Bundle tải 1-on-1 Test Run

- `get_standalone_test_run_bundle(p_run_id, p_assignment_id)` yêu cầu staff authentication và gom việc khôi phục trang 1-on-1 Test Run vào một lời gọi RPC.
- Trong cùng lời gọi database, RPC lấy run hiện tại, assignment/package, tự tạo các section run còn thiếu cùng run items/attempt snapshots, rồi trả toàn bộ sibling runs, item + snapshot hiện tại, package/section narration variant IDs và RAC metric label.
- `getStandaloneTestRunBundle()` ánh xạ payload RPC sang `StandaloneTestRunBundle`; `TeacherTestRunPage.load()` ưu tiên bundle để hydrate run details, all runs, items và audio variants trong một lượt.
- Đường bundle thay thế waterfall khoảng 65 HTTP requests của quy trình khôi phục cũ bằng một database RPC. Khi RPC thiếu, lỗi hoặc trả payload không hợp lệ, trang vẫn chạy chuỗi query cũ làm compatibility fallback.
- Migration triển khai: `20261001010000_standalone_test_run_bundle_rpc.sql`.
### 4.4. Cô lập Dữ liệu Tests 1-1 và Phân tích Standalone theo Quyền sở hữu Lớp

- **Ranh giới vai trò:** Giáo viên (Teacher) chỉ được phép xem các bài tập (`standalone_test_assignments`), phiên chạy (`standalone_test_runs`), và phân tích chi tiết (`TeacherTestAnalysisPage`, `TeacherLearnerTestResultsPage`) của học viên đang ghi danh vào các lớp mà chính giáo viên đó phụ trách (`classes.teacher_user_id = auth.uid()`). Admin có quyền xem phân tích trên toàn trường.
- **Rào chắn Giao diện UI:** `TeacherTestAnalysisPage` và `TeacherTestsPage` đối chiếu `learnerId` của bài test với `operableClassIds` từ `useTeacherClassContext()`. Nếu giáo viên cố gắng truy cập bài test của học viên thuộc lớp giáo viên khác qua URL trực tiếp, giao diện lập tức kích hoạt màn hình chặn truy cập (`EmptyState - ShieldAlert: Không có quyền truy cập`).
- **Rào chắn Cơ sở dữ liệu RLS:** Migration `20261010020000_harden_standalone_test_scoping.sql` thắt chặt hàm `private.staff_can_manage_standalone_test(organization_id, learner_user_id)`. Non-admin teacher chỉ truy vấn được bảng standalone tests nếu học viên đang có enrollment `active` trong một lớp học `active` do teacher đó sở hữu.

---

## 5. Quy tắc Ánh xạ Mã Nguồn (Codebase Mapping Reference)

| Khái niệm Ontology | File Logic Domain | File Giao diện UI | Database / RPC |
|---|---|---|---|
| Roster & Teacher Scope | `web/src/modules/roster/teacher-workspace.ts` | `web/src/pages/teacher/TeacherOverviewPage.tsx` | `users`, `classes`, `enrollments` |
| Multi-Class Context | `web/src/modules/roster/class-context.ts` | `web/src/hooks/useTeacherClassContext.ts` | `classes` |
| Session Scheduling | `web/src/modules/scheduling/session-lifecycle.ts`| `web/src/pages/teacher/TeacherSessionPage.tsx` | `learning_sessions`, `scheduled_sessions` |
| Live Observation | `web/src/modules/assessment/session-capture.ts`, `web/src/lib/live-assessment.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `assessment_attempts`, `assessment_events`, `create_session_question_attempt`, `record_provisional_result`, `resolve_probe` (`20261010070000_fix_live_scoring_and_events_rls.sql`) |
| 7-Color Spectrum | `web/src/modules/result-lifecycle/types.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `result_color` enum, `assessment_attempt_snapshots` |
| Probe Counters | `web/src/modules/assessment/probe-metrics.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `enteredProbeFlow`, `probeCount` |
| Atomic Sync, Scoped Snapshot & OCC | `web/src/lib/supabase-sync.ts` | `web/src/state/AppState.tsx` | `organization_workspace_versions`, `get_workspace_snapshot`, `sync_workspace_atomic` (`20261010030000_fix_workspace_snapshot_user_roles.sql`) |
| Test Packages V2 | `web/src/lib/test-packages.ts` | `web/src/pages/admin/AdminPackageTestsPage.tsx` | `test_packages`, `test_sections`, `test_items` |
| Standalone Test Run Bundle | `web/src/lib/standalone-tests.ts` | `web/src/pages/teacher/TeacherTestRunPage.tsx` | `standalone_test_runs`, `standalone_test_run_items`, `standalone_test_attempts`, `standalone_test_attempt_snapshots`, `narration_variants`, `get_standalone_test_run_bundle` (`20261001010000_standalone_test_run_bundle_rpc.sql`) |
| Standalone Tests Scoping, Serialization & Analysis | `web/src/lib/standalone-tests.ts` | `web/src/pages/teacher/TeacherTestAnalysisPage.tsx`, `TeacherTestsPage.tsx`, `TeacherTestRunPage.tsx` | `private.staff_can_manage_standalone_test`, `record_standalone_provisional_result`, `resolve_standalone_probe` (`20261010080000_serialize_standalone_test_events.sql`) |
