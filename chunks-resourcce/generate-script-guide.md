# Hướng Dẫn Chạy Script Sinh Câu CVR Tự Động

Tài liệu này hướng dẫn cách chạy script sinh câu tiếng Việt & tiếng Anh cùng đo lường các chỉ số CVR dựa trên file dữ liệu từ vựng đầu vào `Chunks-resource - CVR.csv`.

## 1. Yêu Cầu Hệ Thống & Môi Trường
*   Python 3.8 trở lên.
*   Thư viện Python: `requests`
*   NodeJS & npm (để chạy server backend local).

## 2. Các Bước Thực Hiện

### Bước 1: Khởi động Local API Server
1.  Truy cập thư mục dự án `CVR-project`.
2.  Tạo file `.env` chứa Gemini API Key:
    ```env
    GEMINI_API_KEY="YOUR_GEMINI_KEY"
    PORT=3000
    NODE_ENV="development"
    ```
3.  Cài đặt dependencies và chạy server:
    ```bash
    npm install
    npm run dev
    ```
    *Server sẽ khởi động tại địa chỉ: `http://localhost:3000`*

### Bước 2: Chạy Script Xử Lý CSV
1.  Đảm bảo file `Chunks-resource - CVR.csv` nằm trong thư mục `chunks-resourcce/`.
2.  Chạy script Python `process_cvr_csv.py`:
    ```bash
    python -u process_cvr_csv.py
    ```
    *Script sẽ tự động đọc từng dòng từ vựng, tạo danh sách Resources, gọi local API để sinh câu (enforce đúng phrasings) và đo lường chỉ số. Kết quả sẽ liên tục được ghi đè trực tiếp (progressive save) vào file CSV gốc.*

## 3. Các Cột Dữ Liệu Được Bổ Sung
Script sẽ tự động thêm các cột sau vào file CSV:
*   `Complete Sentence (Vie)`: Câu tiếng Việt mẫu tự nhiên chứa từ vựng.
*   `Complete Sentence (Eng)`: Bản dịch tiếng Anh tương ứng.
*   `TC`: Chỉ số Target Concept đo được.
*   `LC`: Chỉ số Length Complexity dựa trên số từ.
*   `TL`: Chỉ số Topic Level (1.0 - 2.0).
*   `CVR`: Chỉ số CVR cuối cùng ($TC \times LC \times TL$).
