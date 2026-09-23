# Chunks LMS - Sample Test Packages Report (Complete Sentence & Multi-Type Traps)

Báo cáo phân tích chuyên sâu 4 bộ bài test mẫu chuẩn hóa theo đúng triết lý đo lường của **Chunks LMS**:

---

## 1. Bảng đối chiếu 4 bài test mẫu

| Mã bài test | Loại bài | Topic | Dữ liệu gốc (Firestore) | Target Voltage (CPD) | Quy chuẩn cấu trúc & Hint Type |
|---|---|---|---|---|---|
| **`G01-9Q-Topic1-Day1Lesson0Orientation`** | **GREEN (Focus)** | Topic 1 | `Day 1 - Lesson 0 Orientation` | **12V** ($CVR \times CCI = 3\Omega \times 4A$) | **100% Câu hoàn chỉnh (Complete Sentences)** phân tầng A2 $\to$ B1 $\to$ B2/C1. Đo sự tập trung & lưu loát nhịp điệu. $TL=1.0$. |
| **`G02-9Q-Topic2-Day2Lesson1Howtosurvive`** | **GREEN (Focus)** | Topic 2 | `Day 2 - Lesson 1 How to survive` | **12V** ($CVR \times CCI = 3\Omega \times 4A$) | **100% Câu hoàn chỉnh sinh tồn**, nhịp thở liền mạch, $TL=1.0$. |
| **`R01-9Q-Topic3-56V`** | **RED (Awareness)** | Topic 3 | `Day 3 - Lesson 2 What you'd like to do?` | **56V** ($CVR \times CCI = 7\Omega \times 8A$) | **9 cấu trúc & 9 loại Hint bẫy nhận thức khác biệt hoàn toàn** (Scale Contrast, Plosives, Latency Hold, Sibilants, Syllabic...). SSML 650ms. |
| **`R02-9Q-Topic4-56V`** | **RED (Awareness)** | Topic 4 | `Day 4 - Lesson 3 I'm a hitchhiker` | **56V** ($CVR \times CCI = 7\Omega \times 8A$) | **9 cấu trúc & 9 loại Hint bẫy nhận thức khác biệt** (Facility-Action, Commercial Duality, Temporal Link, Redundancy Suppression...). SSML 650ms. |

---

## 2. Chi tiết 9 loại Hint Bẫy Nhận Thức khác nhau trong Red Test 1 (`R01-9Q-Topic3-56V`)

Mỗi câu hỏi có **cấu trúc từ ghép khác nhau** và **chỉ dẫn nhận thức (Hint) chuyên biệt**, không trùng lặp:

1. **Câu 1**: *Elephant ; Black cat*  
   - **Loại bẫy**: `Scale Contrast Trap (Đơn thể siêu to vs Cụm từ màu sắc nhỏ)`  
   - **Hint**: *"[Scale Contrast Trap (Đơn thể siêu to vs Cụm từ màu sắc nhỏ)] Điều chỉnh trường năng lượng: Chuyển đổi dứt khoát từ danh từ thực thể lớn sang cụm miêu tả nhỏ sau khoảng ngắt 650ms."*  
   - **SSML Audio**: `<speak><s>Elephant</s> <break time="650ms"/> <s>Black cat</s></speak>`
2. **Câu 2**: *Black dog ; Black cat*  
   - **Loại bẫy**: `Phonetic Terminal Plosive Trap (Bẫy trượt âm cuối /g/ vs /t/)`  
   - **Hint**: *"[Phonetic Terminal Plosive Trap (Bẫy trượt âm cuối /g/ vs /t/)] Bật rõ âm đuôi /g/ ở vế đầu và /t/ ở vế sau; tuyệt đối không để quán tính lặp từ "Black" làm nuốt phụ âm cuối."*  
   - **SSML Audio**: `<speak><s>Black dog</s> <break time="650ms"/> <s>Black cat</s></speak>`
3. **Câu 3**: *Monkey ; Chicken & duck*  
   - **Loại bẫy**: `Acoustic Latency Hold (Kiềm chế phản xạ sớm qua khoảng lặng)`  
   - **Hint**: *"[Acoustic Latency Hold (Kiềm chế phản xạ sớm qua khoảng lặng)] Giữ vững sự điềm tĩnh qua khoảng lặng 650ms; không được vội vàng phát âm cụm liên từ trước khi khoảng ngắt chấm dứt."*  
   - **SSML Audio**: `<speak><s>Monkey</s> <break time="650ms"/> <s>Chicken & duck</s></speak>`
4. **Câu 4**: *Lion ; Tiger*  
   - **Loại bẫy**: `Cognitive Semantic Clash (Đối đầu khái niệm dã thú quen thuộc)`  
   - **Hint**: *"[Cognitive Semantic Clash (Đối đầu khái niệm dã thú quen thuộc)] Tách bạch rõ ràng hai dã thú tương đồng; tránh xu hướng ghép tắt hay đảo vị trí của chuỗi thuật ngữ."*  
   - **SSML Audio**: `<speak><s>Lion</s> <break time="650ms"/> <s>Tiger</s></speak>`
5. **Câu 5**: *Dog & cat ; Snake*  
   - **Loại bẫy**: `Structural Coordination Trap (Cặp vật nuôi kép vs Đơn thú âm xát)`  
   - **Hint**: *"[Structural Coordination Trap (Cặp vật nuôi kép vs Đơn thú âm xát)] Xử lý trơn tru liên từ "&" ở vế trước, sau đó bật âm xát /s/ sắc nét ở vế sau mà không bị ngắc ngứ."*  
   - **SSML Audio**: `<speak><s>Dog & cat</s> <break time="650ms"/> <s>Snake</s></speak>`
6. **Câu 6**: *Cow ; Chicken & duck*  
   - **Loại bẫy**: `Familiarity Suppression Trap (Ức chế quán tính khẩu ngữ)`  
   - **Hint**: *"[Familiarity Suppression Trap (Ức chế quán tính khẩu ngữ)] Ức chế thói quen liên tưởng thành ngữ dân gian; phát âm chuẩn xác từng âm vị theo đúng chuỗi tín hiệu."*  
   - **SSML Audio**: `<speak><s>Cow</s> <break time="650ms"/> <s>Chicken & duck</s></speak>`
7. **Câu 7**: *Snake ; Elephant*  
   - **Loại bẫy**: `Syllabic Rhythm Differential (Đơn âm tiết xát sang Ba âm tiết trọng âm)`  
   - **Hint**: *"[Syllabic Rhythm Differential (Đơn âm tiết xát sang Ba âm tiết trọng âm)] Chuyển đổi nhịp thở từ đơn âm tiết ngắn sang đa âm tiết ba nhịp (el-e-phant) ngay sau độ trễ 650ms."*  
   - **SSML Audio**: `<speak><s>Snake</s> <break time="650ms"/> <s>Elephant</s></speak>`
8. **Câu 8**: *Black dog ; Lion*  
   - **Loại bẫy**: `Categorical Shift Resistance (Chuyển vùng nhận thức gia đình sang hoang dã)`  
   - **Hint**: *"[Categorical Shift Resistance (Chuyển vùng nhận thức gia đình sang hoang dã)] Chuyển dịch tức thì từ trường thú cưng gia đình sang biểu tượng hoang dã; giữ trọng âm đều ở cả hai vế."*  
   - **SSML Audio**: `<speak><s>Black dog</s> <break time="650ms"/> <s>Lion</s></speak>`
9. **Câu 9**: *Tiger ; Monkey*  
   - **Loại bẫy**: `Peak Cognitive Voltage Challenge (Thử thách điện thế nhận thức 56V)`  
   - **Hint**: *"[Peak Cognitive Voltage Challenge (Thử thách điện thế nhận thức 56V)] Tại mức điện áp thử thách cao nhất (56V), kiểm soát hoàn toàn phản xạ kiềm chế và phát âm chuẩn xác cả hai vế."*  
   - **SSML Audio**: `<speak><s>Tiger</s> <break time="650ms"/> <s>Monkey</s></speak>`

---

## 3. Chi tiết 9 loại Hint Bẫy Nhận Thức khác nhau trong Red Test 2 (`R02-9Q-Topic4-56V`)

1. **Câu 1**: *Airport ; Book 2 tickets* $	o$ `Spatial Facility vs Transactional Verb Phrase (Địa điểm vs Hành động)`
2. **Câu 2**: *Bank ; Restaurant & hotel* $	o$ `Commercial Duality Shift (Tài chính công vụ vs Dịch vụ kép)`
3. **Câu 3**: *On Sunday and in May ; Then / after that* $	o$ `Temporal Anchor to Sequential Transition (Mốc thời gian kép vs Từ nối)`
4. **Câu 4**: *Church ; Go to the church* $	o$ `Lexical Redundancy Suppression (Khử lặp từ vựng quán tính)`
5. **Câu 5**: *My brother and my sister ; My grandpa and my grandma* $	o$ `Generational Kinship Balance (Đối xứng nhịp điệu họ hàng hai thế hệ)`
6. **Câu 6**: *Book 2 tickets ; Bank* $	o$ `Operational Divergence (Hành động có đối tượng sang Cơ sở tài chính)`
7. **Câu 7**: *Then / after that ; Go to the church* $	o$ `Discourse Marker to Religious Action (Chuyển tiếp hành động tâm linh)`
8. **Câu 8**: *Restaurant & hotel ; Airport* $	o$ `Logistics Spatial Contrast (Khu nghỉ dưỡng sang Ga hàng không)`
9. **Câu 9**: *On Sunday and in May ; My brother and my sister* $	o$ `Complex Chrono-Social Climax (Đỉnh cao tải nhận thức Thời gian - Xã hội)`

---
*Tất cả 4 file JSON hoàn chỉnh đã được cập nhật tại: `@output/`*
