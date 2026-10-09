# Product Requirements Document (PRD): V1 Single-Org Teacher-Scoped Sync & State Management

**Project:** Chunks-LMS  
**Status:** Approved Architecture Baseline  
**Version:** 1.0.0  
**Date:** 2026-09-28  
**Canonical Anchor:** `docs/architecture/ONTOLOGY.md` & `docs/architecture/ontology.html`

---

## 1. Bối cảnh & Tuyên ngôn Sản phẩm (Product Boundary)

Chunks-LMS là nền tảng đo lường chỉ số **Focus (Tập trung)** và **Awareness (Nhận thức)** của học viên qua các buổi kiểm tra, phiên học do giáo viên trực tiếp quan sát.

### Quyết định Cốt lõi (V1 Design Invariants):
1. **Single-Organization (Một tổ chức duy nhất):**
   * Hệ thống vận hành cho một trường/trung tâm duy nhất.
   * **Tuyệt đối không xây dựng:** Multi-org selector, organization switcher, tenant isolation phức tạp hay chia sẻ liên tổ chức. Bảng `organizations` trong DB được cố định ở `default_organization` (LOCAL_ORG_ID) chỉ để đóng vai trò anchor khóa ngoại, không mang logic nghiệp vụ.
2. **Cô lập Dữ liệu theo Vai trò (Role-Scoped Data Access):**
   * **Teacher:** Chỉ xem và quản lý lớp học của mình (`classes.teacher_user_id = current_user.id`), chỉ xem học viên ghi danh trong các lớp của mình (`enrollments.class_id IN (teacher_classes)`), chỉ xem ca học và kết quả quan sát của mình.
   * **Admin:** Toàn quyền xem và điều phối tất cả các lớp, tất cả giáo viên và tất cả học viên trong trường.
   * **Learner:** Không có tài khoản đăng nhập (Profile-only). Học viên không có quyền truy cập hệ thống.
3. **Đồng bộ Nguyên tử (Atomic Synchronization):**
   * Thay thế quy trình REST Waterfall 10 bước rời rạc bằng **1 lời gọi PostgreSQL RPC nguyên tử duy nhất (`sync_workspace_atomic`)**.
   * Bổ sung cơ chế khóa lạc quan (**Optimistic Concurrency Control - OCC**) thông qua số hiệu phiên bản (`revision`) để triệt tiêu hoàn toàn rủi ro hai giáo viên ghi đè mất dữ liệu của nhau.

---

## 2. Đặc tả Nghiệp vụ & Phạm vi Dữ liệu (Functional Specifications)

### 2.1. Phân quyền và Không gian Làm việc (Workspace Scoping)

| Thực thể | Quyền của Teacher | Quyền của Admin |
|---|---|---|
| **Lớp học (Classes)** | Chỉ thấy các lớp có `teacher_user_id = user.id`. Được tạo lớp mới, xếp chỗ cho lớp của mình. | Thấy toàn bộ lớp học của tất cả giáo viên trong trường. |
| **Học viên (Learners)** | Chỉ thấy danh sách học viên đang ghi danh vào các lớp của mình. Khi tạo học viên mới, học viên tự động được enroll vào lớp được chọn của giáo viên đó. | Thấy toàn bộ học viên của trường. Có quyền chuyển học viên giữa các lớp. |
| **Ca học (Sessions)** | Chỉ tạo, bắt đầu, quan sát (Observe) và kết thúc các ca học thuộc lớp của mình. | Xem toàn bộ lịch sử ca học, nhật ký kiểm toán (Audit log) và phân tích toàn trường. |
| **Tài khoản Staff** | Không có quyền xem hay sửa tài khoản giáo viên khác. | Tạo, kích hoạt, vô hiệu hóa tài khoản Teacher/Admin. |
| **Cấu hình Metrics** | Đọc các chỉ số chuẩn để chấm điểm. | Chỉnh sửa catalog ngưỡng đo lường Focus/Awareness. |

### 2.2. Cơ chế Đồng bộ Dữ liệu (Sync Mechanics)

#### A. Đọc Dữ liệu (Scoped Workspace Load)
* Thay vì `select('*')` trên toàn bộ cơ sở dữ liệu rồi lọc bằng JavaScript, client gọi hàm RPC hoặc truy vấn scoped:
  * Input: `p_user_id` và `p_role`.
  * Nếu là `Teacher`: Trả về snapshot chỉ chứa các lớp, học sinh, ca học gắn liền với `p_user_id`.
  * Nếu là `Admin`: Trả về snapshot toàn bộ trường.
* **Lợi ích:** Kích thước payload giảm 90%, triệt tiêu rủi ro vượt quá giới hạn 1.000 dòng của PostgREST.

#### B. Ghi Dữ liệu (Atomic Workspace Save with OCC)
* Gửi toàn bộ payload mutation của scope hiện tại qua RPC:
  ```json
  {
    "scope_role": "teacher",
    "teacher_user_id": "...",
    "expected_revision": 42,
    "roster_delta": { ... },
    "scheduling_delta": { ... }
  }
  ```
* Database thực hiện trong 1 Transaction (`BEGIN ... COMMIT`):
  1. Kiểm tra `expected_revision`: Nếu server đang có revision lớn hơn, từ chối với lỗi `CONFLICT_REVISION_MISMATCH`.
  2. Cập nhật các bảng liên quan.
  3. Tăng `revision = revision + 1`.
  4. Trả về kết quả thành công và revision mới.

#### C. Xử lý Sĩ số Lớp học (Capacity Constraint Settlement)
* Trigger kiểm tra sĩ số `trg_enforce_class_capacity` được cấu hình dạng **Statement-level** hoặc **Deferred**:
  * Đảm bảo cho phép hoán đổi học viên (xóa học viên A, thêm học viên B trong cùng một payload) mà không bị exception giữa chừng.

---

## 3. Ranh giới Kỹ thuật (Technical Constraints & Non-Goals)

1. **Non-Goals:**
   * Không xây dựng giao diện chuyển đổi Tenant / Organization.
   * Không hỗ trợ một giáo viên thuộc nhiều trường khác nhau trong cùng một session.
   * Không mở lại Learner Portal hay share-link public cho học sinh.
2. **Invariants (Bất biến):**
   * Mọi can thiệp chấm điểm (Probes: `enteredProbeFlow`, `probeCount`) và kết quả (`finalized_results`) phải giữ tính bất biến (Immutable append-only).
   * Không được phá vỡ 47 test suites hiện hữu của `web/`.

---

## 4. Tiêu chí Nghiệm thu (Acceptance Criteria)

1. **AC-1 (Teacher Data Isolation):**
   * Tạo 2 tài khoản giáo viên: Teacher A và Teacher B.
   * Teacher A tạo Lớp A và thêm Học viên A.
   * Đăng nhập Teacher B: Đảm bảo danh sách Lớp học và Học viên của Teacher B hoàn toàn trống, không nhìn thấy Học viên A.
2. **AC-2 (Admin Omniscience):**
   * Đăng nhập Admin: Nhìn thấy cả Lớp A (của Teacher A) và các lớp của Teacher B.
3. **AC-3 (Atomic Rollback on Error):**
   * Cố tình gửi payload vi phạm ràng buộc dữ liệu: Database rollback 100%, không để lại bản ghi rác nửa vời.
4. **AC-4 (OCC Conflict Prevention):**
   * Giả lập 2 tab cùng sửa một lớp với cùng `expected_revision`: Tab thứ hai nhận thông báo `CONFLICT` và tự động cập nhật dữ liệu mới nhất thay vì ghi đè.
