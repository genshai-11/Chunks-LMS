# Chunks-LMS Canonical Feature Ontology & Function Specifications

**File Version:** 1.0.0  
**Status:** CANONICAL FEATURE ONTOLOGY (Single Source of Truth)  
**Governing Documents:** `AGENTS.md`, `docs/architecture/ONTOLOGY.md`, `docs/architecture/ontology.html`, `docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md`  
**Last Updated:** 2026-10-19  

> ⚠️ **BẮT BUỘC ĐỐI VỚI TẤT CẢ DEVELOPERS & AGENTS (Triple-Sync Protocol):**  
> File này là **ĐẶC TẢ TÍNH NĂNG & FUNCTION FLOW CHÍNH THỨC** của toàn bộ hệ thống Chunks-LMS.  
> Bất kỳ thay đổi code nào làm thay đổi logic nghiệp vụ, function contracts, trạng thái vòng đời (lifecycle), luồng dữ liệu (data flow) hoặc quyền hạn (scoping) **BẮT BUỘC PHẢI ĐƯỢC CẬP NHẬT ĐỒNG THỜI VÀO 3 NƠI:**  
> 1. `FEATURES.md` (Đặc tả chi tiết tính năng, logic, function contracts)  
> 2. `docs/architecture/ONTOLOGY.md` (Đặc tả thực thể, bất biến và ranh giới phân quyền)  
> 3. `docs/architecture/ontology.html` (Giao diện trực quan hóa kiến trúc hệ thống)  

---

## 1. Bản Đồ Tổng Quan & Ranh Giới Sản Phẩm (Product Boundary)

Chunks-LMS là nền tảng đo lường chỉ số **Tập trung (Focus)** và **Nhận thức (Awareness)** của người học thông qua **quan sát đánh giá trực tiếp của giáo viên (Teacher-Observed Assessment)** dựa trên vật lý nhận thức (Cognitive Vocal Resistance - CVR và Cognitive Power Dissipation - CPD). Hệ thống **không** phải là một CMS biên soạn nội dung đại trà hay thư viện khóa học công cộng.

### 1.1. Mô Hình Định Danh V1 (Single Org & Scoped Staff)
* **Single Organization:** Hệ thống cố định ở 1 tổ chức duy nhất (`LOCAL_ORG_ID = 'a0000000-0000-4000-8000-000000000001'`). Không có logic chuyển đổi tenant/organization.
* **Admin (Quản trị viên):** Quản lý tài khoản nhân sự (Active/Inactive), phân công giáo viên vào lớp, cấu hình danh mục bài kiểm tra (Test Packages), duyệt file âm thanh TTS, và xem báo cáo tổng hợp toàn trường.
* **Teacher (Giáo viên):** Quản lý cây học viên trong các lớp mình phụ trách, lên lịch ca học (`LearningSession`), thực hiện quan sát chấm điểm trực tiếp (`Observe`), giao và chạy bài test 1-on-1 (`Standalone Tests`), và xem phân tích tiến độ lớp mình.
* **Learner (Học viên):** Không có tài khoản đăng nhập web. Hồ sơ học viên do giáo viên/admin quản lý; kết quả được đánh giá thông qua quan sát trực tiếp hoặc bài test 1-on-1.

```text
                                [Organization Anchor (LOCAL_ORG_ID)]
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             [Admin (Supabase Auth)]                           [Teacher (Supabase Auth)]
             • Accounts Management                             • Own Classes & Enrolled Learners
             • Test Packages & Audio Generation                • Live Observation (Observe)
             • School-wide Analytics                           • 1-on-1 Standalone Tests
             • Full Ops & Audit Board                          • Class Progress Analytics
```

---

## 2. Bản Đồ Module & Cấu Trúc Mã Nguồn (System Architecture Map)

| Module / Thư Mục | Trách Nhiệm Nghiệp Vụ | Dữ Liệu & Hợp Đồng Chính |
|---|---|---|
| `web/src/auth/` | Xác thực nhân sự, phiên làm việc Supabase Auth, phân quyền vai trò (`admin`, `teacher`). | `StaffSessionContext`, `StaffGate`, `staff_roles`, `users.auth_user_id`. |
| `web/src/modules/roster/` | Quản lý cây học viên, khóa học (`courses`), lớp học (`classes`), sĩ số và ghi danh (`enrollments`). | `teacher-workspace.ts`, `class-context.ts`, `service.ts`, `users`, `classes`, `enrollments`. |
| `web/src/modules/scheduling/` | Lập kế hoạch ca học, trạng thái ca học (`draft`, `active`, `completed`), phân loại ca (`regular`, `pretest`, `posttest`). | `session-lifecycle.ts`, `learning_sessions`, `scheduled_sessions`. |
| `web/src/modules/assessment/` | Runtime quan sát chấm điểm trực tiếp (Live Observe), chuyển đổi trạng thái câu hỏi, cơ chế probe counters ($n$). | `session-capture.ts`, `capture-mode.ts`, `dynamic-acn.ts`, `live-assessment.ts`, `assessment_attempts`, `assessment_attempt_snapshots`. |
| `web/src/modules/result-lifecycle/` | Vòng đời kết quả đánh giá: ghi điểm tạm thời (provisional), hoàn thiện (finalized), hiệu chỉnh (corrected) và kiểm toán bất biến. | `state-machine.ts`, `types.ts`, `assessment_events` (append-only), `result_color`. |
| `web/src/modules/catalog/` | Danh mục bài kiểm tra, phiên bản, sections, items, tính toán vật lý $CVR = TC \times LC \times TL$, $CPD = CVR \times CCI$, mini-test variant generator. | `test-package-catalog.ts`, `live-test-generation.ts`, `spoken-scripts.ts`, `test_packages`, `test_sections`, `test_items`. |
| `web/src/modules/metrics/` | Tính toán chỉ số Focus/Awareness, bảng màu 7 bước, RFC (Rate of Functional Struggle), RAC / %c / %r, dynamic ACN, focus stability. | `calculate.ts`, `settings.ts`, `standalone-settings.ts`, `display-labels.ts`. |
| `web/src/lib/standalone-tests.ts` | Khởi tạo bài tập test 1-on-1, RPC bundle hydration, serialization chống double-click, audio prefix chaining, ghi nhận probe test. | `get_standalone_test_run_bundle`, `record_standalone_provisional_result`, `resolve_standalone_probe`, `standalone_test_runs`. |
| `web/src/lib/supabase-sync.ts` | Đồng bộ dữ liệu atomic OCC qua Supabase RPC, snapshot có scope theo giáo viên, xử lý xung đột revision, fallback REST. | `get_workspace_snapshot`, `sync_workspace_atomic`, `organization_workspace_versions`. |
| `web/src/state/AppState.tsx` | Quản lý state toàn cục React Context, cơ chế debounce auto-save (700ms), manual `syncNow`, cờ đồng bộ `workspaceRevision`. | `AppStateProvider`, `useAppState`. |

---

## 3. Đặc Tả Chi Tiết Từng Phân Hệ Tính Năng (Detailed Feature Catalog)

### 3.1. Phân Hệ Xác Thực & Phân Quyền Nhân Sự (Staff Auth & Access Control)

#### Mô Tả & Luồng Nghiệp Vụ
1. Nhân sự đăng nhập thông qua 3 hình thức:
   - Email + Password: `supabase.auth.signInWithPassword`.
   - Magic Link OTP: `supabase.auth.signInWithOtp`.
   - Username Login: Gọi Edge Function `username-login` $\rightarrow$ giải mã email $\rightarrow$ cấp access/refresh tokens.
2. Thiết lập phiên làm việc (`StaffSessionContext`):
   - Nhận diện `auth.users.id`.
   - Truy vấn `public.users` theo `auth_user_id = auth.users.id` (bắt buộc `account_status == 'active'`).
   - Truy vấn `public.staff_roles` theo `user_id = users.id` và `active = true`.
3. Phân cấp quyền:
   - Grant `admin` tự động tổng hợp quyền `teacher` (`roles.add('teacher')`).
   - `StaffGate` chặn truy cập: Admin truy cập được cả `/admin/*` và `/teacher/*`; Teacher chỉ truy cập `/teacher/*`.

#### Hợp Đồng Hàm & API Chính
* `loadStaffRolesByAuthUserId(authUserId: string | null)`: Nạp domain user và quyền staff.
* `resolveActiveStaffRoles(grants: StaffRole[])`: Chuẩn hóa danh sách quyền (admin bao hàm teacher).
* `canAccessStaffRole(staffRoles: Set<StaffRole>, required: StaffRole)`: Kiểm tra quyền truy cập route.

---

### 3.2. Phân Hệ Roster, Lớp Học & Cô Lập Dữ Liệu Giáo Viên (Roster & Teacher Scoping)

#### Mô Tả & Luồng Nghiệp Vụ
1. **Cô lập Lớp học (Class Scoping):**
   - Mỗi lớp học (`classes`) bắt buộc có một giáo viên phụ trách (`teacher_user_id IS NOT NULL`).
   - Giáo viên chỉ được xem và thao tác trên các lớp do chính mình phụ trách (`classes.teacher_user_id = current_user.id`).
   - Hook `useTeacherClassContext()` cung cấp danh sách `operableClassIds` cho các màn hình giáo viên.
2. **Cô lập Học viên (Learner Scoping):**
   - Giáo viên chỉ nhìn thấy học viên đang ghi danh (`active` hoặc `ended`) vào các lớp của mình.
   - Khi tạo học viên mới trên giao diện Teacher, **bắt buộc** phải chọn 1 lớp do mình phụ trách để ghi danh ngay lập tức; không cho phép tạo học viên tự do không gắn lớp (unassigned learner).
3. **Ràng Buộc Sĩ Số Lớp (Class Capacity Invariant):**
   - Mỗi lớp có `capacity` (mặc định là 3).
   - Số lượng `enrollments` có `status = 'active'` không được vượt quá `classes.capacity`.
   - Cơ chế hoán đổi học viên (swap): Cho phép trong 1 transaction kết thúc enrollment cũ và thêm enrollment mới mà không bị chặn giữa chừng.

#### Hợp Đồng Hàm & API Chính
* `resolveTeacherClassScope(roster, signedInTeacher)`: Lọc danh sách lớp theo giáo viên (fail-closed).
* `createCourse(roster, { code, name })`: Khởi tạo khóa học mới.
* `createClass(roster, { courseId, name, capacity, teacherUserId })`: Khởi tạo lớp học gán giáo viên.
* `enrollLearner(roster, { classId, learnerUserId })`: Ghi danh học viên (kiểm tra sĩ số và `allowMultiClass`).
* `endEnrollment(roster, { enrollmentId })`: Kết thúc ghi danh của học viên.
* `createTeacherLearnerAndEnroll` (Database RPC): Tạo học viên và ghi danh vào lớp của giáo viên trong 1 atomic transaction.

---

### 3.3. Phân Hệ Lập Kế Hoạch Ca Học (Session Scheduling & Lifecycle)

#### Mô Tả & Luồng Nghiệp Vụ
1. **Vòng Đời Ca Học (`LearningSession`):**
   $$\text{draft} \xrightarrow{\text{start}} \text{active} \xrightarrow{\text{finish}} \text{completed}$$
   *(Có thể hủy: `cancelled`)*.
2. **Phân Loại Ca Học (`sessionKind`):**
   - `regular`: Ca học thông thường hàng ngày.
   - `pretest`: Ca kiểm tra đầu vào (baseline).
   - `posttest`: Ca kiểm tra đầu ra (đánh giá tiến bộ so với baseline RFC/RAC).
3. **Định Danh Ca Học:**
   - Mỗi ca học gắn với một `class_id` và giáo viên phụ trách (`owner_user_id`).
   - Hỗ trợ số thứ tự buổi học (`session_number`) và danh sách học viên tham gia cụ thể (`participant_learner_ids`).
   - Cơ chế khóa ca học (`lock_expires_at`) ngăn chặn nhiều giáo viên đồng thời can thiệp vào cùng một ca học.

#### Hợp Đồng Hàm & API Chính
* `startLearningSession(scheduling, { sessionId, startedAt })`: Kích hoạt ca học sang trạng thái `active`.
* `completeLearningSession(scheduling, { sessionId, completedAt })`: Hoàn thành ca học sang `completed`.
* `createScheduledSession(scheduling, params)`: Lên lịch ca học dự kiến.

---

### 3.4. Phân Hệ Quan Sát Trực Tiếp & Thu Thập Điểm (Live Assessment Capture)

#### Mô Tả & Luồng Nghiệp Vụ
1. **Chế Độ Hiển Thị Quan Sát (Dual UI Modes):**
   - `question_first`: Duyệt từng câu hỏi; mỗi câu hỏi gắn với một học viên theo vòng tròn luân phiên (round-robin).
   - `learner_first`: Duyệt theo từng học viên; bước nhảy chỉ số cách đều theo số lượng học viên để quan sát liên tục một học viên qua nhiều câu hỏi.
   - `splitMode` (Màn hình chia đôi): Tự động kích hoạt khi ca học có chính xác 2 học viên (`learnerIds.length === 2`). Hiển thị 2 khung quan sát độc lập, điều khiển bằng phím tắt (`Tab` chuyển học viên, `0-3` chấm màu, `F/C/D` xử lý probe).
2. **Bảng Màu Quang Phổ 7 Bước (7-Color Spectrum):**

| Màu (Identifier) | Nhóm Màu | Tính Chất Đánh Giá | DB Enum | Hệ Số Điểm | %x Mặc Định | Phím Tắt Observe |
|---|---|---|---|---|---|---|
| **Red** | Warm | Khó khăn nặng (Struggle) | `'red'` | `0.00` | $0\%$ | `0` |
| **Orange** | Warm | Khó khăn vừa (Partial struggle)| `'orange'` | `0.17` | $17\%$ | `1` |
| **Yellow** | Warm | Thất bại khi giải probe (Fail) | `'yellow'` | `0.34` | $34\%$ | `F` / `1` (khi probe) |
| **Green** | Cool | Thành công mở đầu / Vào probe | `'green'` | `0.50` | $50\%$ | `2` |
| **Blue** | Cool | Vượt qua bước probe (Continue) | `'blue'` | `0.67` | $67\%$ | `C` / `2` (khi probe) |
| **Indigo** | Cool | Hoàn thành probe xuất sắc (Done)| `'indigo'` | `0.84` | $84\%$ | `D` / `3` / `Enter` |
| **Purple** | Cool | Nắm vững trực tiếp (Mastery) | `'purple'` | `1.00` | $100\%$ | `3` |

3. **Cơ Chế Đo Lường Probe ($n$ Counters):**
   - **Vào Probe (`enteredProbeFlow = true`):** Giáo viên nhấn Green (`2`). Bắt đầu quá trình probe với $n = 1$ (`probeCount = 0`).
   - **Tiếp Tục (`Continue` / Phím `C` / Blue):** Học viên qua được thêm một chunk gợi ý. Tăng `probeCount = probeCount + 1`, hiển thị $n$ tăng lên $2, 3, \dots$. Không giới hạn trần probe.
   - **Thất Bại (`Fail` / Phím `F` / Yellow):** Học viên dừng lại ở mức hiện tại. **Không tăng `probeCount`** (`probeCount` giữ nguyên). Kết quả chốt là Yellow, $n$ dừng ở mức độ sâu thất bại.
   - **Hoàn Thành (`Done` / Phím `D` / Indigo):** Học viên giải quyết trọn vẹn chunk cuối cùng. **Tăng `probeCount = probeCount + 1`** và chốt kết quả là Indigo.
4. **Các Chỉ Số Thống Kê Probe Trong Ca Học:**
   - **`n count` (`nCount`):** Tổng số câu hỏi giáo viên chọn Green để vào luồng probe (`enteredProbeFlow = true`).
   - **`n depth` (`nDepth`):** Độ sâu probe của một câu hỏi cụ thể: $\max(1, \text{probeCount} + 1)$.
   - **`n depth max` (`nDepthMax`):** Độ sâu probe lớn nhất ghi nhận được trong ca học.
   - **`n depth avg` (`nDepthAvg`):** Độ sâu probe trung bình của các câu có vào luồng probe.

#### Hợp Đồng Hàm & API Chính
* `createLiveQuestion(params)`: Tạo câu hỏi quan sát mới kèm draft attempt thông qua RPC `create_session_question_attempt`.
* `recordLiveColor(params)`: Ghi nhận màu chấm tạm thời (provisional) qua RPC `record_provisional_result` hoặc hiệu chỉnh qua `correct_final_result`.
* `resolveLiveProbe(params)`: Xử lý kết quả probe qua RPC `resolve_probe` (`p_outcome: 'fail' | 'continue' | 'done'`).
* `syncCaptureSessionToServer(capture)`: Lưu đồng bộ toàn bộ dữ liệu ca học lên cơ sở dữ liệu khi kết thúc ca.

---

### 3.5. Vòng Đời Kết Quả & Bất Biến Kiểm Toán (Result Lifecycle & Audit Immutability)

#### Trạng Thái Vòng Đời Của Một Đánh Giá (Attempt Lifecycle)
```text
            [DRAFT]
               │
        record_provisional
               │
       ┌───────┴───────┐
       ▼               ▼
  (Red/Orange/Purple) (Green)
       │               │
       ▼               ▼
  [FINALIZED]     [PROBE_OPEN]
       │               │
       │       resolve_probe (continue / fail / done)
       │               │
       │               ▼
       └───────>  [FINALIZED]
                       │
             correct_final_result (bắt buộc reason)
                       │
                       ▼
                  [CORRECTED]
```

#### Quy Tắc Bất Biến Về Dữ Liệu Kết Quả:
1. **Append-Only Stream:** Bảng `assessment_events` ghi nhận toàn bộ lịch sử biến động (`assessment_created`, `provisional_recorded`, `probe_continued`, `probe_failed`, `probe_completed`, `result_finalized`, `result_corrected`). Không có quyền UPDATE hay DELETE trên bảng này.
2. **Cấm Xóa Vật Lý (No Hard Delete):** Không được phép thực hiện `DELETE FROM learning_sessions` hoặc xóa cascade `assessment_attempts`/`assessment_events`. Mọi sai sót cần hủy phải chuyển `status = 'cancelled'`.
3. **Hiệu Chỉnh Có Kiểm Toán (Audit Correction):** Điểm số đã finalize chỉ được phép thay đổi thông qua lệnh hiệu chỉnh (`correct_final_result`), bắt buộc phải ghi nhận lý do hiệu chỉnh (`reason`), màu cũ (`previous_color`) và màu mới (`color`).

---

### 3.6. Danh Mục Bài Kiểm Tra & Vật Lý Nhận Thức (Test Packages & Cognitive Physics)

#### Cấu Trúc Phân Cấp Bài Test
$$\text{TestPackage} \xrightarrow{1..N} \text{TestPackageVersion} \xrightarrow{1..N} \text{TestSection} \xrightarrow{1..N} \text{TestItem}$$
* Mỗi phiên bản bài test (`TestPackageVersion`) khi xuất bản (`published`) được gán một mã băm bất biến `snapshot_hash`.
* Mỗi bài test chuẩn gồm **7 sections** $\times$ **7 items** $= 49$ câu hỏi (hoặc biến thể Mini-Test gồm **7 sections** $\times$ **3 items** $= 21$ câu hỏi).

#### Các Công Thức Vật Lý Nhận Thức
1. **Trở Kháng Phát Âm Nhận Thức (Cognitive Vocal Resistance - $CVR$, đơn vị $\Omega$):**
   $$CVR = TC \times LC \times TL$$
   - $TC$ (**Term/Chunk Complexity**): Số lượng chunk/từ gợi ý ($1$ cho bài Green Focus; $2..4$ cho bài Red Collocations).
   - $LC$ (**Lexical/Length Complexity**): Tính theo độ dài số từ $w$ của câu:
     $$LC = \begin{cases}
       1.0 & w \le 8 \\
       1.0 + \frac{w - 8}{6} \times 0.4 & 8 < w \le 14 \quad (\le 1.4) \\
       1.4 + \frac{w - 14}{3} \times 0.3 & 14 < w \le 17 \quad (\le 1.7) \\
       1.7 + \frac{w - 17}{5} \times 0.3 & 17 < w \le 22 \quad (\le 2.0) \\
       2.0 + \min\left(0.5, \frac{w - 22}{10} \times 0.5\right) & w > 22 \quad (\le 2.5)
     \end{cases}$$
   - $TL$ (**Time Latency**): Độ trễ thời gian phản hồi ($1.0$ cho luồng nói trôi chảy liên tục; $2.0..3.0$ cho nói ngắt quãng có khoảng dừng $650\,\text{ms}$).
2. **Công Suất Tiêu Tán Nhận Thức (Cognitive Power Dissipation - $CPD$, đơn vị $\text{V}$):**
   $$CPD = CVR \times CCI$$
   - Mục tiêu chuẩn: Green Focus $= 12\,\text{V}$; Red Awareness $= 56\,\text{V}$.
3. **Chỉ Số Dòng Nhận Thức (Cognitive Current Index - $CCI$, đơn vị $\text{A}$):**
   $$CCI = \max\left(1, \operatorname{round}\left(\frac{\text{Target CPD}}{CVR}\right)\right)$$

#### Trình Sinh Biến Thể Mini-Test Không Lãng Phí Âm Thanh (Zero-Waste Mini-Test Generator)
* Hàm `createMiniTestVariantFromPackage`: Lấy mẫu bài test 49 câu xuống 21 câu (giữ 7 sections, mỗi section chọn 3 items tiêu biểu).
* Tái sử dụng $100\%$ file âm thanh đã sinh: Liên kết `narration_variants` của bài test mới trực tiếp với `audio_asset_id` hiện có, **tuyệt đối không gọi TTS sinh lại**, tiết kiệm chi phí và tài nguyên.

---

### 3.7. Thực Thi Bài Test 1-on-1 Độc Lập (Standalone Test Execution)

#### Vòng Đời Bài Test 1-on-1
1. **Giao Bài (`Assignment`):** Admin hoặc Teacher giao bài test cho một học viên (`create_standalone_test_assignment`).
2. **Chuẩn Bị Ca Chạy (`prepare_standalone_test_run`):** Kiểm tra tính sẵn sàng của âm thanh (`readiness_hash`) và tạo cấu trúc ca chạy.
3. **Bắt Đầu Ca Chạy (`start_standalone_test_run`):** Chuyển trạng thái sang `in_progress`.
4. **Bundle Hydration Nhanh (`get_standalone_test_run_bundle`):** Gom toàn bộ $\sim 65$ queries riêng lẻ (runs, items, snapshots, package audio, section intros) vào **1 lần gọi RPC duy nhất**.
5. **Chaining Phát Âm Thanh 2 Bước (Audio Prefix Chaining):**
   - Bước 1: Phát file số thứ tự `/audio/number_{order}.wav` (`item_prefix`).
   - Bước 2: Khi file số kết thúc, tự động phát ngay file TTS đọc câu hỏi (`pendingItemAudio`).
   - Khi có kết quả chấm: Phát âm thanh phản hồi (ví dụ: `/audio/red.wav`, `/audio/purple.wav`), sau đó tự động chuyển và phát âm thanh câu kế tiếp.
6. **Tuần Tự Hóa Sự Kiện Chống Xung Đột (Event Serialization):**
   - Áp dụng khóa hàng `FOR UPDATE` trên `standalone_test_run_items` và `standalone_test_attempt_snapshots`.
   - Tính toán `event_sequence` động từ `COALESCE(MAX(event_sequence), 0) + 1` để triệt tiêu lỗi duplicate key khi giáo viên nhấn phím nhanh hoặc double-click.

---

### 3.8. Động Cơ Tính Toán Chỉ Số & Phân Tích (Metrics Engine & Reporting)

#### Bảng Công Thức Chỉ Số Đo Lường Chính
1. **Chỉ Số Khó Khăn (Rate of Functional Struggle - RFC):**
   Tỷ lệ các bước nằm ở vùng màu ấm (Red, Orange, Yellow) trên tổng số bước đánh giá:
   $$RFC = \frac{N_{\text{red}} + N_{\text{orange}} + N_{\text{yellow}}}{N_{\text{total}}}$$
2. **Chỉ Số Nhận Thức / Thành Công (%c / %r / RAC):**
   Điểm trung bình trọng số chuẩn hóa theo hệ số quang phổ:
   $$\text{Avg \%x} = \frac{\sum_{\text{color}} \left( N_{\text{color}} \times \text{PercentX}_{\text{color}} \right)}{N_{\text{total}}}$$
   *(Hiển thị nhãn `%r` cho bài Red Awareness và `%c` cho bài Green Focus)*.
3. **Độ Ổn Định Tập Trung (Focus Stability):**
   $$FocusStability = 1 - \frac{\frac{1}{m-1} \sum_{j=2}^{m} |Score_j - Score_{j-1}|}{3}$$
4. **Độ Phục Hồi Nhận Thức (Awareness Recovery):**
   $$AwarenessRecovery = \frac{\text{Số câu probe kết thúc bằng Indigo hoặc Purple}}{N_{\text{probed}}}$$
5. **Chỉ Số Chunks Trung Bình Động (Dynamic Average Chunks Number - Dynamic ACN):**
   - **Preset `v2_completed` (Mặc định):**
     $$ACN = \frac{N_{\text{total}} - (N_{\text{green}} + N_{\text{blue}} + N_{\text{indigo}})}{n_{\text{finalized}}}$$
   - **Preset `v2_fixed49` (Số câu cố định):**
     $$ACN = \frac{N_{\text{total}} - (N_{\text{green}} + N_{\text{blue}} + N_{\text{indigo}})}{n_{\text{total\_items}}}$$
   - **Preset `v1_legacy`:**
     $$ACN = \frac{\sum n\_depth}{N_{\text{probed}}}$$

---

### 3.9. Đồng Bộ Dữ Liệu Nguyên Tử & Điều Khiển Đồng Thời Lạc Quan (Atomic Sync & OCC)

#### Chu Trình Đồng Bộ Hai Chiều
1. **Đọc Dữ Liệu Có Scope (`get_workspace_snapshot`):**
   - Admin nhận toàn bộ dữ liệu tổ chức.
   - Teacher chỉ nhận các lớp mình phụ trách, học viên ghi danh vào lớp mình, ca học thuộc lớp mình và bộ đếm revision hiện tại.
2. **Ghi Dữ Liệu Nguyên Tử & Kiểm Tra Revision (`sync_workspace_atomic`):**
   - Client gửi payload chuẩn hóa kèm `p_expected_revision`.
   - RPC khóa hàng `organization_workspace_versions` bằng `SELECT ... FOR UPDATE`.
   - Nếu `p_expected_revision < current_revision`: Bắn lỗi `CONFLICT_REVISION_MISMATCH`, hủy ghi, yêu cầu người dùng reload để tránh đè dữ liệu.
   - Nếu hợp lệ: Cập nhật toàn bộ thực thể trong 1 transaction PostgreSQL duy nhất và tăng revision $+1$.
3. **Cơ Chế Lưu Trữ Phía Client (`AppState.tsx`):**
   - **Debounced Auto-Save:** Timer 700ms tự động kích hoạt khi có thay đổi ở `roster` hoặc `scheduling`.
   - **Manual `syncNow`:** Đồng bộ cưỡng bức tức thời kèm xác minh tính bền vững (`verifyWorkspacePersistence`).
   - **Local Storage Cache:** Lưu trữ snapshot cục bộ tức thì giúp ứng dụng không bị mất dữ liệu khi mất mạng đột ngột.

---

## 4. Hệ Thống Các Bất Biến Bắt Buộc (Canonical System Invariants)

1. **Bất Biến Bất Khả Xâm Phạm Dữ Liệu Điểm Số (Assessment Immutability):**
   Tuyệt đối không chạy câu lệnh `DELETE` hay `UPDATE` đè lên `assessment_events` đã ghi nhận. Sửa điểm bắt buộc phải qua luồng hiệu chỉnh có lưu vết kiểm toán (`result_corrected`).
2. **Bất Biến Sĩ Số Lớp Học & Hoán Đổi Ghế (Class Capacity Constraint):**
   Số lượng học viên `active` trong một lớp không được vượt quá `classes.capacity`. Ràng buộc kiểm tra phải cho phép thực hiện hoán đổi học viên trong cùng một payload atomic mà không bị bắn lỗi giữa chừng.
3. **Bất Biến Kiểm Soát Đồng Thời Lạc Quan (Optimistic Concurrency Control):**
   Không chấp nhận ghi đè dữ liệu nếu revision của client cũ hơn revision của server (`CONFLICT_REVISION_MISMATCH`).
4. **Bất Biến Cô Lập Theo Vai Trò (Role-Scoped Isolation):**
   Giáo viên tuyệt đối không được truy cập, xem hoặc chỉnh sửa lớp học, học viên, ca học hay bài test của giáo viên khác dưới bất kỳ hình thức nào (kể cả thao tác URL trực tiếp hay gọi API/RPC).
5. **Bất Biến Gắn Kết Giáo Viên - Lớp Học (Class Teacher Integrity):**
   Mọi lớp học bắt buộc phải có một giáo viên phụ trách duy nhất (`teacher_user_id IS NOT NULL`).

---

## 5. Bảng Ánh Xạ Logic Nghiệp Vụ - File Mã Nguồn - Database / RPC

| Khái Niệm / Nghiệp Vụ | File Xử Lý Logic (Domain) | File Giao Diện (UI / Pages) | Database Tables / RPCs / Migrations |
|---|---|---|---|
| **Staff Auth & Gating** | `web/src/auth/StaffSessionContext.tsx`, `staff-roles.ts` | `web/src/auth/StaffGate.tsx`, `StaffSignInForm.tsx` | `public.users`, `public.staff_roles`, Edge Function `username-login` |
| **Roster & Teacher Scoping**| `web/src/modules/roster/teacher-workspace.ts`, `service.ts` | `web/src/pages/teacher/TeacherOverviewPage.tsx`, `TeacherClassesPage.tsx` | `public.classes`, `public.enrollments`, `public.courses`, `createTeacherLearnerAndEnroll` |
| **Multi-Class Hook** | `web/src/modules/roster/class-context.ts` | `web/src/hooks/useTeacherClassContext.ts` | Bảng `classes` (`teacher_user_id`) |
| **Session Scheduling** | `web/src/modules/scheduling/session-lifecycle.ts` | `web/src/pages/teacher/TeacherSessionPage.tsx` | `public.learning_sessions`, `public.scheduled_sessions` |
| **Live Observe Capture** | `web/src/modules/assessment/session-capture.ts`, `web/src/lib/live-assessment.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `assessment_attempts`, `assessment_attempt_snapshots`, `assessment_events`, `create_session_question_attempt` |
| **Live Scoring & Probes** | `web/src/modules/assessment/capture-mode.ts`, `state-machine.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `record_provisional_result`, `resolve_probe`, `correct_final_result` (`20261020000000_fix_scoping_sync_and_scoring.sql`) |
| **7-Color Spectrum Factor**| `web/src/modules/result-lifecycle/types.ts` | `web/src/pages/teacher/TeacherObservePage.tsx` | `public.result_color` enum (`20260815014013_add_7_color_spectrum_values.sql`) |
| **Test Packages Catalog** | `web/src/lib/test-packages.ts`, `modules/catalog/*` | `web/src/pages/admin/AdminPackageTestsPage.tsx` | `public.test_packages`, `test_sections`, `test_items`, `audio_assets`, `narration_variants` |
| **Standalone Tests 1-on-1** | `web/src/lib/standalone-tests.ts` | `web/src/pages/teacher/TeacherTestRunPage.tsx`, `TeacherTestsPage.tsx` | `standalone_test_runs`, `standalone_test_run_items`, `get_standalone_test_run_bundle` (`20261001010000`), `record_standalone_provisional_result` (`20261010080000`) |
| **Standalone Test Scoping** | `web/src/lib/standalone-tests.ts` | `web/src/pages/teacher/TeacherTestAnalysisPage.tsx` | `private.staff_can_manage_standalone_test` (`20261010020000_harden_standalone_test_scoping.sql`) |
| **Metrics Engine** | `web/src/modules/metrics/calculate.ts`, `dynamic-acn.ts` | `web/src/pages/teacher/TeacherTestAnalysisPage.tsx`, `TeacherAnalysisPage.tsx` | Các hàm tính toán `calculateMetrics`, `n_*`, RFC, RAC, Focus Stability |
| **Atomic Sync & OCC** | `web/src/lib/supabase-sync.ts` | `web/src/state/AppState.tsx` | `organization_workspace_versions`, `get_workspace_snapshot`, `sync_workspace_atomic` (`20261020000000_fix_scoping_sync_and_scoring.sql`) |
