## Phase 1: Fix Database Constraints and CSV Parsing Issues
- [x] 1.1 Remove generated column `measured_cvr` from test items insertions in AdminLiveTestsPage.tsx
- [x] 1.2 Omit `override_reason` in default snapshot inserts to satisfy check constraint rules
- [x] 1.3 Implement a robust CSV parsing algorithm in frontend that parses quoted commas and handles Chunks spreadsheet headers

## Phase 2: Seed and Migrate Vocabulary & Sentence Resources
- [x] 2.1 Copy source vocabulary spreadsheet chunks-resourcce directory locally
- [x] 2.2 Configure import script to map item CVR target values to the `Unit (Ohm)` column instead of the computed sheet CVR
- [x] 2.3 Run import tool to generate local seed SQL file
- [x] 2.4 Create Supabase migration file `20260719072000_seed_cvr_vocabulary_items.sql` containing both the seed items and the V2 schema backfill steps

## Phase 3: Xây dựng `/generate-CVR` Engine
- [x] 3.1 Thiết lập Endpoint API / Edge Function `/generate-CVR` nhận tham số: target Ohm, topic/day
- [x] 3.2 Viết Prompts hướng dẫn LLM phối hợp từ vựng chính (Pink - 3 Ohm) với các Helper (Green, Blue)
- [x] 3.3 Điều chỉnh các hệ số LC (độ dài) và TL (độ sâu) trong Prompt sinh câu của LLM để tích nhân đạt chính xác target Ohm
- [x] 3.4 Viết Unit test kiểm tra độ chính xác của các câu tự động sinh theo Ohm mục tiêu

## Phase 4: Giao diện Quản trị Admin V2
- [x] 4.1 Xây dựng màn hình liên kết Learning Session với Test Packages và Test Sections
- [x] 4.2 Tích hợp nút kích hoạt sinh câu tự động `/generate-CVR` cho từng Session trực tiếp trên giao diện Admin
- [x] 4.3 Thêm tính năng duyệt (approve) hoặc sinh lại (regenerate) câu hỏi
