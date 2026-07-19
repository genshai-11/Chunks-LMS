# TTS Generation Architecture and Reuse Guide

Hệ thống **CHUNKS** tích hợp module Text-to-Speech (TTS) hỗ trợ 3 nhà cung cấp chính: **ElevenLabs**, **Deepgram**, và **9Router** (OpenAI TTS compatible gateway). Tài liệu này bóc tách cấu trúc code hiện tại và hướng dẫn tái sử dụng.

---

## 1. Cấu Trúc File & Module Hiện Tại

### A. Client-side: [audioService.ts](file:///C:/Users/gensh/OneDrive/Máy%20tính/LUCY/PROJECT-WORKPLACE/CHUNKS/CVR-project/src/services/audioService.ts)
*   **Hàm chính**: `generateAudio(text, settings, lang)`
*   **Cơ chế hoạt động**:
    *   Nếu provider là `deepgram` hoặc `elevenlabs`: Client gọi trực tiếp tới API tương ứng bằng API Key của Client. Trả về âm thanh dưới dạng `Data URL` (Base64).
    *   Nếu provider là `9router`: Gọi trực tiếp tới `/v1/audio/speech` của 9Router.
*   *Lưu ý: Do sử dụng `FileReader` của browser để encode blob thành Base64, hàm này được thiết kế để chạy trực tiếp trên Browser.*

### B. Server-side Proxy: [server.ts](file:///C:/Users/gensh/OneDrive/Máy%20tính/LUCY/PROJECT-WORKPLACE/CHUNKS/CVR-project/server.ts)
Để bảo mật API key và tránh lỗi CORS trên Browser, server cung cấp 2 Endpoint proxy:
1.  `POST /api/tts`: Proxy tới ElevenLabs.
2.  `POST /api/tts/9router/speech`: Proxy tới 9Router (OpenAI-compatible).

---

## 2. Mã Nguồn Tái Sử Dụng (Reusable Code Snippets)

### A. Tái sử dụng Proxy trong NodeJS / TypeScript (Backend Script)
Nếu bạn muốn viết một script NodeJS ở backend để sinh audio và lưu thành file `.mp3`, bạn có thể tái sử dụng đoạn logic chuyển ArrayBuffer thành Buffer của Server:

```typescript
import fs from 'fs';
import fetch from 'node-fetch'; // Nếu chạy ở node cổ, node 18+ đã có sẵn fetch toàn cục

async function downloadTTSFile(text: string, outputPath: string) {
  const SERVER_URL = "http://localhost:3000/api/tts/9router/speech";
  
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer <KEY>' // Nếu cần
    },
    body: JSON.stringify({
      endpoint: "https://api.9router.com", // hoặc URL proxy 9Router của bạn
      model: "tts-1",
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }

  const data = await response.json();
  const base64Audio = data.audioContent; // Lấy dữ liệu base64
  
  // Ghi file nhị phân từ Base64
  const buffer = Buffer.from(base64Audio, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved audio to ${outputPath}`);
}
```

### B. Tái sử dụng Proxy trong Python (Automation Script)
Dưới đây là hàm Python tích hợp trực tiếp để tải audio từ proxy server, rất dễ kết hợp vào các script xử lý dữ liệu:

```python
import requests
import base64

def save_tts_from_proxy(text, output_file_path):
    url = "http://localhost:3000/api/tts/9router/speech"
    payload = {
        "endpoint": "https://api.9router.com",
        "model": "tts-1",  # Hoặc giọng nói tiếng Việt của 9Router
        "input": text
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    r = requests.post(url, headers=headers, json=payload)
    if r.status_code == 200:
        audio_b64 = r.json().get("audioContent")
        # Decode base64 sang nhị phân
        audio_data = base64.b64decode(audio_b64)
        with open(output_file_path, "wb") as f:
            f.write(audio_data)
        print(f"Audio saved to {output_file_path}")
    else:
        print(f"Error: {r.status_code} - {r.text}")
```
