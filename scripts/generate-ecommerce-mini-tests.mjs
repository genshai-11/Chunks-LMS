import fs from 'node:fs'
import path from 'node:path'

// 1. Path Configuration
const IMPROV_SOURCE_PATH = path.resolve(
  'C:/Users/gensh/Desktop/CHUNKS/PROJECT/database-structure/chunks-class/public/data/improv_set_05.json',
)
const OUTPUT_DIR = path.resolve(process.cwd(), '@output')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// 2. Mathematical & Physics Model
export const GREEN_TEST_SESSION_LANGUAGES_7X3 = ['en', 'en', 'en', 'vi', 'vi', 'vi', 'en']
export const RED_TEST_SESSION_LANGUAGES_7X3 = ['vi', 'vi', 'vi', 'en', 'en', 'en', 'en']
export const RED_TEST_HINT_PROGRESSION_7X3 = [2, 3, 4, 2, 3, 4, 4]

export function calculateCvr(tc, lc, tl) {
  return Number((tc * lc * tl).toFixed(1))
}

export function calculateCpd(cvr, cci) {
  return Number((cvr * cci).toFixed(1))
}

export function calculateCciFromCpd(targetCpd, cvr) {
  if (cvr <= 0) return 1
  return Math.max(1, Math.round(targetCpd / cvr))
}

// 3. Load Improv Source Data
if (!fs.existsSync(IMPROV_SOURCE_PATH)) {
  throw new Error(`Improv source file not found at: ${IMPROV_SOURCE_PATH}`)
}

const improvData = JSON.parse(fs.readFileSync(IMPROV_SOURCE_PATH, 'utf8'))
console.log(`Loaded Improv Set 05: "${improvData.title}" with ${improvData.sessions.length} sessions`)

// Separate items by hint count
const itemsByHc = {
  2: improvData.sessions.find((s) => s.hcTotal === 2)?.items || [],
  3: improvData.sessions.find((s) => s.hcTotal === 3)?.items || [],
  4: improvData.sessions.find((s) => s.hcTotal === 4)?.items || [],
  5: improvData.sessions.find((s) => s.hcTotal === 5)?.items || [],
}

console.log(`Available items: hc2=${itemsByHc[2].length}, hc3=${itemsByHc[3].length}, hc4=${itemsByHc[4].length}, hc5=${itemsByHc[5].length}`)

function formatSentence(hints, lang = 'vi') {
  if (lang === 'vi') {
    const raw = hints.map((h) => h.text.trim()).join(' ')
    const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1)
    return capitalized.endsWith('.') ? capitalized : capitalized + '.'
  }
  const raw = hints.map((h) => h.translation.trim()).join(' ')
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1)
  return capitalized.endsWith('.') ? capitalized : capitalized + '.'
}

// 4. Generator for Red Mini Test Package (21 Questions: 7x3)
function generateRedMiniTestPackage({ packageIndex, offset = 0 }) {
  const packageCode = `R0${packageIndex}-21Q-Ecommerce-56V-${packageIndex}`
  const title = `R0${packageIndex}-21Q-Ecommerce: E-commerce Market Dynamics & Consumer Reflexes (Awareness 56V)`
  const slug = `r0${packageIndex}-21q-ecommerce-56v-${packageIndex}`
  const description = `Red Mini Test (7x3 - 21 Questions) with cognitive traps, SSML 650ms breaks, target 56V CPD, and per-session TTS presets from Improv Set 05.`
  const targetQuestions = 21
  const targetCpd = 56
  const sessionLayout = '7x3'
  const sessionLanguages = [...RED_TEST_SESSION_LANGUAGES_7X3]

  // Hint count progression: [2, 3, 4, 2, 3, 4, 4]
  // Session 1: 3 items hc:2
  // Session 2: 3 items hc:3
  // Session 3: 3 items hc:4
  // Session 4: 3 items hc:2
  // Session 5: 3 items hc:3
  // Session 6: 3 items hc:4
  // Session 7: 3 items hc:4
  const sessionItemSources = [
    { hc: 2, start: offset + 0 },
    { hc: 3, start: offset + 0 },
    { hc: 4, start: offset + 0 },
    { hc: 2, start: offset + 3 },
    { hc: 3, start: offset + 3 },
    { hc: 4, start: offset + 3 },
    { hc: 4, start: offset + 6 },
  ]

  const sections = []
  let globalItemNumber = 0

  for (let s = 1; s <= 7; s++) {
    const sessionConfig = sessionItemSources[s - 1]
    const hintCount = RED_TEST_HINT_PROGRESSION_7X3[s - 1]
    const tc = hintCount
    const lc = 1.15 // Compound eCommerce Lexical Complexity
    const tl = Number((2.0 + ((s - 1) / 6) * 1.0).toFixed(1)) // 2.0 to 3.0
    const cvr = calculateCvr(tc, lc, tl)
    const cci = calculateCciFromCpd(targetCpd, cvr)
    const cpd = calculateCpd(cvr, cci)
    const sessionLanguage = sessionLanguages[s - 1]
    const part = s <= 2 ? 1 : s <= 4 ? 2 : 3

    const sourcePool = itemsByHc[sessionConfig.hc]
    const sessionItems = []

    for (let i = 0; i < 3; i++) {
      globalItemNumber += 1
      const itemIdx = (sessionConfig.start + i) % sourcePool.length
      const rawItem = sourcePool[itemIdx]
      const hints = rawItem.hints.slice(0, hintCount)

      const termVi = hints.map((h) => h.text).join(' + ')
      const termEn = hints.map((h) => h.translation).join(' + ')
      const promptVi = hints.map((h) => h.text).join(' / ')
      const promptEn = hints.map((h) => h.translation).join(' / ')
      const spokenScriptVi = `<speak>${hints.map((h) => `<s>${h.text}</s>`).join(' <break time="650ms"/> ')}</speak>`
      const spokenScriptEn = `<speak>${hints.map((h) => `<s>${h.translation}</s>`).join(' <break time="650ms"/> ')}</speak>`

      sessionItems.push({
        itemOrder: i + 1,
        globalItemNumber,
        sourceItemId: rawItem.id,
        chunkIds: hints.map((h) => h.id),
        termVi,
        termEn,
        promptVi,
        promptEn,
        spokenScriptVi,
        spokenScriptEn,
        tc,
        lc,
        tl,
        measuredCvr: cvr,
        cvrBreakdown: {
          tc,
          lc,
          tl,
          cvr,
          cci,
          cpd,
        },
        hints: hints.map((h) => ({
          id: h.id,
          text: h.text,
          translation: h.translation,
          typeFunction: h.typeFunction,
        })),
      })
    }

    sections.push({
      sectionOrder: s,
      part,
      title: `Session ${s} • ${hintCount} Hints (Awareness Trap)`,
      targetCvrOhm: cvr,
      cciAmpe: cci,
      cpd,
      hintCount,
      sessionLanguage,
      voiceModel: sessionLanguage === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F',
      introTextVi: `Session ${s}: Mức kháng trở ${cvr} Ohm, cường độ ${cci} Ampe. Bẫy nhận thức ${hintCount} cụm từ. Chuẩn bị.`,
      introTextEn: `Session ${s}: Resistance ${cvr} Ohm, current ${cci} Amps. ${hintCount}-hint cognitive trap. Get ready.`,
      items: sessionItems,
    })
  }

  return {
    packageCode,
    title,
    slug,
    description,
    versionLabel: 'v1',
    testType: 'RED',
    targetQuestions,
    sessionLayout,
    targetCpd,
    sessionLanguages,
    lifecycleNarration: {
      package_start: {
        vi: 'Chào mừng em đến với bài kiểm tra Red Test eCommerce & Retail (Awareness & Traps). Lắng nghe khoảng lặng giữa các cụm từ bẫy và phản xạ dứt khoát.',
        en: 'Welcome to the Red Test eCommerce & Retail assessment. Pay close attention to pauses between cognitive traps and respond with conviction.',
      },
      part_intro: {
        1: {
          vi: 'Bắt đầu Phần 1: Bẫy 2-3 cụm từ phản xạ thị trường và săn deal nhanh.',
          en: 'Starting Part 1: Rapid 2-3 hint consumer and deal-hunting traps.',
        },
        2: {
          vi: 'Bắt đầu Phần 2: Xử lý chuỗi liên kết và cấu trúc bán lẻ đa cụm từ.',
          en: 'Starting Part 2: Multi-chunk retail chain logic and structural shifts.',
        },
        3: {
          vi: 'Bắt đầu Phần 3: Thử thách ẩn dụ chuyên sâu và áp lực nhận thức đỉnh cao.',
          en: 'Starting Part 3: Advanced idiomatic metaphors and peak cognitive recovery.',
        },
      },
      package_end: {
        vi: 'Chúc mừng em đã hoàn thành bài kiểm tra Red Test eCommerce 21Q! Em đã vượt qua các bẫy nhận thức thương mại điện tử rất xuất sắc.',
        en: 'Congratulations on completing the 21Q eCommerce Red Test! Exceptional awareness and trap recovery reflexes.',
      },
    },
    sections,
    totalItems: globalItemNumber,
  }
}

// 5. Generator for Green Mini Test Package (21 Questions: 7x3)
function generateGreenMiniTestPackage({ packageIndex, offset = 10 }) {
  const packageCode = `G0${packageIndex}-21Q-Ecommerce-${packageIndex}`
  const title = `G0${packageIndex}-21Q-Ecommerce: E-commerce Market Dynamics & Shopping Reflex (Focus 12V)`
  const slug = `g0${packageIndex}-21q-ecommerce-${packageIndex}`
  const description = `Green Mini Test (7x3 - 21 Questions) for fluent focus, complete sentences, TL=1.0, target 12V CPD, and per-session TTS presets from Improv Set 05.`
  const targetQuestions = 21
  const targetCpd = 12
  const sessionLayout = '7x3'
  const sessionLanguages = [...GREEN_TEST_SESSION_LANGUAGES_7X3]

  // CVR progression for Green 7 sessions: [2, 2, 3, 3, 4, 4, 6] Ohm
  // CCI progression: [6, 6, 4, 4, 3, 3, 2] A
  // Product: CVR * CCI = 12V exactly!
  const greenCvrCurve = [2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]
  const greenCciCurve = [6, 6, 4, 4, 3, 3, 2]

  const sessionItemSources = [
    { hc: 2, start: offset + 0 },
    { hc: 2, start: offset + 3 },
    { hc: 3, start: offset + 0 },
    { hc: 3, start: offset + 3 },
    { hc: 4, start: offset + 0 },
    { hc: 4, start: offset + 3 },
    { hc: 5, start: offset + 0 },
  ]

  const sections = []
  let globalItemNumber = 0

  for (let s = 1; s <= 7; s++) {
    const sessionConfig = sessionItemSources[s - 1]
    const cvr = greenCvrCurve[s - 1]
    const cci = greenCciCurve[s - 1]
    const cpd = calculateCpd(cvr, cci)
    const tl = 1.0 // Continuous sentence focus
    const lc = 1.0
    const tc = cvr
    const sessionLanguage = sessionLanguages[s - 1]
    const part = s <= 2 ? 1 : s <= 4 ? 2 : 3

    const sourcePool = itemsByHc[sessionConfig.hc]
    const sessionItems = []

    for (let i = 0; i < 3; i++) {
      globalItemNumber += 1
      const itemIdx = (sessionConfig.start + i) % sourcePool.length
      const rawItem = sourcePool[itemIdx]

      const sentenceVi = formatSentence(rawItem.hints, 'vi')
      const sentenceEn = formatSentence(rawItem.hints, 'en')
      const termVi = rawItem.hints.map((h) => h.text).join(' ')
      const termEn = rawItem.hints.map((h) => h.translation).join(' ')

      sessionItems.push({
        itemOrder: i + 1,
        globalItemNumber,
        sourceItemId: rawItem.id,
        chunkIds: rawItem.hints.map((h) => h.id),
        termVi,
        termEn,
        promptVi: sentenceVi,
        promptEn: sentenceEn,
        spokenScriptVi: null,
        spokenScriptEn: null,
        tc,
        lc,
        tl,
        measuredCvr: cvr,
        cvrBreakdown: {
          tc,
          lc,
          tl,
          cvr,
          cci,
          cpd,
        },
        hints: rawItem.hints.map((h) => ({
          id: h.id,
          text: h.text,
          translation: h.translation,
          typeFunction: h.typeFunction,
        })),
      })
    }

    sections.push({
      sectionOrder: s,
      part,
      title: `Session ${s} • ${cvr}Ω (Focus Sentence)`,
      targetCvrOhm: cvr,
      cciAmpe: cci,
      cpd,
      hintCount: 1,
      sessionLanguage,
      voiceModel: sessionLanguage === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F',
      introTextVi: `Session ${s}: Mức kháng trở ${cvr} Ohm, cường độ ${cci} Ampe. Mục tiêu 12V CPD. Phát âm câu trôi chảy.`,
      introTextEn: `Session ${s}: Resistance ${cvr} Ohm, current ${cci} Amps. Target 12V CPD. Speak fluently.`,
      items: sessionItems,
    })
  }

  return {
    packageCode,
    title,
    slug,
    description,
    versionLabel: 'v1',
    testType: 'GREEN',
    targetQuestions,
    sessionLayout,
    targetCpd,
    sessionLanguages,
    lifecycleNarration: {
      package_start: {
        vi: 'Chào mừng em đến với bài kiểm tra Green Test eCommerce (Focus). Lắng nghe trọn vẹn và phát âm câu hoàn chỉnh với nhịp điệu tự nhiên.',
        en: 'Welcome to the Green Test eCommerce assessment. Listen attentively and articulate each complete sentence with natural flow.',
      },
      part_intro: {
        1: {
          vi: 'Bắt đầu Phần 1: Phản xạ câu đơn giản về thị trường thương mại điện tử cơ bản.',
          en: 'Starting Part 1: Basic eCommerce sentence rhythms and core retail vocabulary.',
        },
        2: {
          vi: 'Bắt đầu Phần 2: Mở rộng câu ghép và cấu trúc hành vi người tiêu dùng trực tuyến.',
          en: 'Starting Part 2: Compound sentence expansion and consumer behavior patterns.',
        },
        3: {
          vi: 'Bắt đầu Phần 3: Thử thách tập trung câu phức hợp và chiến lược bán lẻ hiện đại.',
          en: 'Starting Part 3: Complex sentence integration and high-level retail strategy.',
        },
      },
      package_end: {
        vi: 'Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra Green Test eCommerce 21Q. Em đã thể hiện sự tập trung và ngữ điệu rất xuất sắc!',
        en: 'Congratulations on completing the 21Q eCommerce Green Test. Outstanding focus and fluency sustained throughout!',
      },
    },
    sections,
    totalItems: globalItemNumber,
  }
}

// 6. Generate the 4 packages
const packages = [
  { filename: 'G01-21Q-Ecommerce-1.json', data: generateGreenMiniTestPackage({ packageIndex: 1, offset: 0 }) },
  { filename: 'G02-21Q-Ecommerce-2.json', data: generateGreenMiniTestPackage({ packageIndex: 2, offset: 12 }) },
  { filename: 'R01-21Q-Ecommerce-56V-1.json', data: generateRedMiniTestPackage({ packageIndex: 1, offset: 0 }) },
  { filename: 'R02-21Q-Ecommerce-56V-2.json', data: generateRedMiniTestPackage({ packageIndex: 2, offset: 10 }) },
]

console.log('\n--- Generating 4 eCommerce Mini Test Packages ---')
for (const p of packages) {
  const filePath = path.join(OUTPUT_DIR, p.filename)
  fs.writeFileSync(filePath, JSON.stringify(p.data, null, 2), 'utf8')
  console.log(`✓ Wrote ${p.filename} (${p.data.sections.length} sessions, ${p.data.totalItems} questions, ${p.data.testType})`)
}

// 7. Generate Comprehensive README.md in @output/
const readmeContent = `# Chunks LMS • eCommerce Mini Test Suite (7x3 Architecture)

Generated from **Improv Set 05: E-commerce & Retail (Market Dynamics & Shopping Reflex)**.

---

## 1. Mini Test Architecture (7 Sessions × 3 Questions = 21 Questions)

Both Green and Red tests follow the high-efficiency **7x3 mini test structure**:
- **7 sessions per test package**
- **3 questions per session**
- **Total: 21 questions**
- Structured across 3 pedagogical parts:
  - **Part 1:** Sessions 1–2 (Foundation & core consumer reaction)
  - **Part 2:** Sessions 3–4 (Compound logic & retail chain connectors)
  - **Part 3:** Sessions 5–7 (Advanced metaphors, high cognitive resistance & peak fluency)

---

## 2. Mathematical & Physics Model

| Metric | Symbol | Unit | Definition | Green Test Value | Red Test Value |
|---|---|---|---|---|---|
| **Term Complexity** | $TC$ | Count | Number of chunks / semantic elements | $1$ (sentence core) | $2 - 4$ hints |
| **Lexical Complexity** | $LC$ | Factor | Domain lexical density & syllable clash | $1.0$ (standard) | $1.15$ (compound eCommerce) |
| **Time Latency** | $TL$ | Factor | Pacing & cognitive hesitation allowance | $1.0$ (continuous) | $2.0 - 3.0$ (with 650ms pauses) |
| **Cognitive Voltage Resistance** | $CVR$ | $\\Omega$ | $CVR = TC \\times LC \\times TL$ | $2.0 - 6.0\\ \\Omega$ | $4.6 - 13.8\\ \\Omega$ |
| **Cognitive Current Index** | $CCI$ | $\\text{A}$ | Cognitive processing rate | $2\\text{A} - 6\\text{A}$ | $4\\text{A} - 12\\text{A}$ |
| **Cognitive Power Dissipation** | $CPD$ | $\\text{V}$ | $CPD = CVR \\times CCI$ | **$12\\text{V}$** (Focus Target) | **$56\\text{V}$** (Awareness Target) |

---

## 3. Package Inventory & Comparison

| Package Code | Test Type | CPD Target | Hint Count Progression | CVR Curve ($\\Omega$) | CCI Curve (A) | Session Languages |
|---|---|---|---|---|---|---|
| **\`G01-21Q-Ecommerce-1\`** | GREEN (Focus) | 12V | Single complete sentence | \`[2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]\` | \`[6, 6, 4, 4, 3, 3, 2]\` | EN-EN-EN-VI-VI-VI-EN |
| **\`G02-21Q-Ecommerce-2\`** | GREEN (Focus) | 12V | Single complete sentence | \`[2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]\` | \`[6, 6, 4, 4, 3, 3, 2]\` | EN-EN-EN-VI-VI-VI-EN |
| **\`R01-21Q-Ecommerce-56V-1\`** | RED (Awareness) | 56V | \`[2, 3, 4, 2, 3, 4, 4]\` | \`[4.6, 7.6, 10.6, 5.8, 9.3, 12.9, 13.8]\` | \`[12, 7, 5, 10, 6, 4, 4]\` | VI-VI-VI-EN-EN-EN-EN |
| **\`R02-21Q-Ecommerce-56V-2\`** | RED (Awareness) | 56V | \`[2, 3, 4, 2, 3, 4, 4]\` | \`[4.6, 7.6, 10.6, 5.8, 9.3, 12.9, 13.8]\` | \`[12, 7, 5, 10, 6, 4, 4]\` | VI-VI-VI-EN-EN-EN-EN |

---

## 4. Per-Session TTS Audio Configuration & Neural2 Voices

### Green Test Preset: \`['en', 'en', 'en', 'vi', 'vi', 'vi', 'en']\`
- **Sessions 1–3 (Part 1 + S3):** English (\`en-US-Neural2-F\`)
- **Sessions 4–6 (Part 2 + S6):** Vietnamese (\`vi-VN-Neural2-A\`)
- **Session 7 (Part 3 Peak):** English (\`en-US-Neural2-F\`)

### Red Test Preset: \`['vi', 'vi', 'vi', 'en', 'en', 'en', 'en']\`
- **Sessions 1–3 (Part 1 + S3):** Vietnamese (\`vi-VN-Neural2-A\`)
- **Sessions 4–7 (Part 2 & Part 3):** English (\`en-US-Neural2-F\`)

### SSML Semantic Gap Specification (Red Tests)
Every Red test question injects exact 650ms semantic pauses between hints to measure learner cognitive recovery:
\`\`\`xml
<speak><s>Ngành thương mại điện tử</s> <break time="650ms"/> <s>cạnh tranh khốc liệt</s></speak>
\`\`\`
All SSML requests automatically route to Google Cloud **Neural2** voices to ensure natural prosody across pauses.

---

## 5. Verification Checklist

- [x] Exactly 21 questions per package (7 sessions × 3 items).
- [x] Red tests follow exact hint sequence: \`[2, 3, 4, 2, 3, 4, 4]\`.
- [x] Green tests maintain $TL=1.0$ continuous complete sentence structure with 12V CPD target.
- [x] Red tests compute $CVR = TC \\times LC \\times TL$ ($LC=1.15$, $TL \\in [2.0, 3.0]$) with 56V CPD target.
- [x] Audio Studio supports language presets and per-session voice toggle.
`

fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readmeContent, 'utf8')
console.log('✓ Wrote @output/README.md documentation')
console.log('\nAll 4 eCommerce mini test packages generated successfully!')
