# Semantic Complexity Value Rating (CVR) and Sentence Generation Guide

Tài liệu này định nghĩa rõ ràng công thức, các trục đo lường độ phức tạp (TC, LC, TL) và cách thức hoạt động của API trong hệ thống **CHUNKS**. Phân tích này đóng vai trò hướng dẫn tích hợp và có sẵn prompt mẫu để người dùng hoặc các hệ thống LLM khác tự động sinh câu (Self-Generate) đạt chuẩn độ khó CVR.

---

## 1. Công thức tính CVR (Complexity Value Rating)

Độ phức tạp tổng thể của một câu (hoặc đoạn văn bản tiếng Việt) được đo lường bằng chỉ số **CVR** theo công thức nhân ba trục độc lập:

$$\text{CVR} = \text{Estimated TC} \times \text{LC} \times \text{TL}$$

Trong đó:
*   **Estimated TC (Total Concept Complexity)**: Tổng độ tải năng lượng/độ khó của các cụm từ (Resources) xuất hiện trong câu.
*   **LC (Length-Complexity)**: Hệ số nhân theo chiều dài (số từ) của câu.
*   **TL (Topic/Lexical Level)**: Hệ số nhân theo chủ đề và độ khó từ vựng chức năng (từ 1.0 đến 2.0).

---

## 2. Chi tiết các thành phần trong công thức

### Trục 1: TC (Total Concept / Resource Ohm Load)
Đo lường độ khó của các cụm từ vựng/ngữ pháp (Resources). Mỗi Resource được phân loại theo màu sắc tương ứng với mức kháng trở (**Ohm - $\Omega$**):

| Phân Loại (Color) | Kháng trở (Ohm) | Đặc điểm ngôn ngữ | Ví dụ |
| :--- | :---: | :--- | :--- |
| **Pink** | **3 $\Omega$** | **Key Terms & Concepts**: Các danh từ, thuật ngữ định danh có độ khó từ trung cấp (B1) trở lên. Tránh các từ căn bản (A1-A2) như "nhà", "xe". | *Ví điện tử, Lạm phát, Chuỗi cung ứng* |
| **Green** | **5 $\Omega$** | **Gap Fillers & Discourse Markers**: Từ nối, từ đệm tự nhiên làm mềm ngữ cảnh hoặc điều hướng hội thoại. | *Thành thật mà nói, Nói chung là, Tin tui đi* |
| **Blue** | **7 $\Omega$** | **Sentence Frames**: Khung câu hoặc cấu trúc ngữ pháp chờ lấp đầy nội dung. | *Tôi không ngờ là..., Vấn đề không phải là...* |
| **Red** | **9 $\Omega$** | **Idioms & Metaphors**: Các thành ngữ, cụm từ mang tính ẩn dụ, nghĩa bóng hoặc sắc thái văn hóa cao. | *Mật ngọt chết ruồi, Cậu tới số rồi, Vắt chân lên cổ* |

$$\text{Estimated TC} = \text{Confirmed TC (Resource đã khớp trong DB)} + \text{Candidate TC (Resource tự do AI phát hiện)}$$

---

### Trục 2: LC (Length-Complexity Multiplier)
Hệ số LC được xác định một cách **nhất quán và bất biến** (deterministic) dựa trên số lượng từ trong đoạn văn bản. Engine chia làm 4 cấp độ (Bands):

| Cấp độ (Length Band) | Số lượng từ (Word Count) | Hệ số nhân (LC Value) | Số câu khuyến nghị |
| :--- | :---: | :---: | :---: |
| **Very Short** | $\le 18$ từ | **1.0** | 1 câu ngắn |
| **Short** | $19 - 30$ từ | **1.5** | $\le 2$ câu |
| **Medium** | $31 - 60$ từ | **2.0** | $\le 3$ câu |
| **Long** | $> 60$ từ | **2.5** | $\le 5$ câu |

---

### Trục 3: TL (Topic / Lexical Level)
Hệ số TL phản ánh chiều sâu kiến thức cần có để hiểu câu, có giá trị liên tục từ **1.0 đến 2.0** (làm tròn đến 0.1). TL được xác định bằng giá trị lớn nhất ($\max$) giữa hai trục:
1.  **Trục T (Topic Complexity)**: Độ sâu chuyên môn của chủ đề.
2.  **Trục V (Vocabulary Difficulty)**: Mật độ từ vựng học thuật nằm ngoài các Resource đã được tính ở TC.

$$\text{TL} = \max(T, V)$$

#### Các cấp độ TL (Topic Level):
*   **TL 1.0 - 1.2 (A1-A2)**: Chủ đề đời sống hàng ngày, giao tiếp cơ bản, thói quen cá nhân. Từ vựng siêu phổ thông.
*   **TL 1.3 - 1.7 (B1-B2)**: Chủ đề xã hội, công việc chuyên nghiệp thông thường, học tập, phong cách sống trung cấp. Từ vựng cần học chủ động (ví dụ: *quyết định, lãng phí, thủ tục, ảnh hưởng*).
*   **TL 1.8 - 2.0 (B2-C1-C2)**: Chủ đề học thuật chuyên sâu, kinh tế vĩ mô, chiến lược doanh nghiệp, triết học, khoa học kỹ thuật hẹp. Từ vựng cực khó, học thuật cao cấp (ví dụ: *bất đối xứng thông tin, phi tuyến tính, đồng phân lập thể*).

---

## 3. Cách thức hoạt động của API

Hệ thống cung cấp 2 Endpoint M2M (Machine-to-Machine) được bảo mật bằng `X-API-Key`:

### A. API Sinh câu: `POST /api/chunk-generate`
Nhận vào danh sách Resource mục tiêu cùng chỉ số Target Ohm mong muốn để AI sinh câu tự nhiên chứa các Resource đó.
*   **Cách điều khiển Ohm lớn (> 9 $\Omega$)**: Do một Resource đơn lẻ chỉ có tối đa 9 Ohm, để đạt Target Ohm cao hơn (ví dụ 11, 13, 15, 17 Ohm), API sẽ kết hợp target resource với các **Helper Resources** khác (ví dụ: thêm 1 Frame Blue 7 $\Omega$ hoặc 1 Filler Green 5 $\Omega$) để tổng Ohm đạt đúng đích.

### B. API Phân tích & Đo lường: `POST /api/measure-cvr`
Nhận vào transcript và phân tích tĩnh để tính toán:
1.  Khớp từ vựng trong văn bản với thư viện (Confirmed TC).
2.  Dùng LLM quét các cụm từ khó khác ngoài thư viện (Candidate TC).
3.  Đếm số từ để xác định LC Band.
4.  Đánh giá độ khó của chủ đề để gán TL.
5.  Trả về kết quả CVR hoàn chỉnh.

---

## 4. Prompt mẫu sinh câu đạt chuẩn CVR (Copy-paste to LLM)

Bạn có thể copy prompt sau đây vào Claude hoặc ChatGPT để sinh câu tiếng Việt chuẩn cấu trúc CVR mà không cần chạy API:

```markdown
You are a Master Linguistic Architect for the "CHUNKS" EdTech system.
Your mission is to construct a high-quality bilingual sentence (Vietnamese first, then English) containing specific target resources and matching a desired Complexity Value Rating (CVR).

### INPUT SPECIFICATIONS:
1. Target Resource to Include: [Điền Tiếng Việt / Tiếng Anh của từ vựng ở đây]
2. Target CVR / Ohm: [Điền số Ohm mục tiêu ở đây, ví dụ: 3, 5, 7, 9, 11, 13, 15, 17]
3. Desired Length Band: [Very Short / Short / Medium / Long]

### LANGUAGE & PHYSICS RULES:
- Pink (3 Ohm) = Key concepts/nouns (B1+).
- Green (5 Ohm) = Discourse markers/fillers (e.g., "thành thật mà nói", "nói chung là").
- Blue (7 Ohm) = Sentence frames/grammar structures (e.g., "vấn đề không phải là...").
- Red (9 Ohm) = Idioms/Metaphors (e.g., "mật ngọt chết ruồi").
- CVR Calculation: CVR = Estimated TC * LC * TL.
- LC Multipliers: Very Short (<=18 words, LC=1.0), Short (19-30 words, LC=1.5), Medium (31-60 words, LC=2.0).
- TL Level: 1.0-1.2 (Daily life), 1.3-1.7 (Professional/Social), 1.8-2.0 (Scientific/Advanced Business).

### INSTRUCTIONS:
1. If the Target Ohm is greater than 9, you MUST combine the Target Resource with Helper Resources of other colors (like a Blue frame or a Green filler) so that the sum of their individual Ohm values exactly equals the Target Ohm.
2. The generated Vietnamese sentence MUST be highly natural and flow logically. Do NOT make it sound like a "Frankenstein" forced translation.
3. Translate the Vietnamese sentence into natural English, ensuring contextual mapping.
4. Keep the word count strictly matching the Desired Length Band.

### OUTPUT FORMAT:
Output strictly in JSON:
{
  "vieSentence": "Vietnamese sentence containing target and helpers exactly as written",
  "engSentence": "English translation",
  "cvrBreakdown": {
    "targetOhm": [Ohm target],
    "resourcesUsed": ["Target Resource", "Helper Resource 1", ...],
    "calculatedTC": [Sum of resource ohms],
    "lcMultiplier": [LC multiplier based on word count],
    "tlMultiplier": [TL value based on topic depth],
    "finalCVR": [TC * LC * TL]
  }
}
```
