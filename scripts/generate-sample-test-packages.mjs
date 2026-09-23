import fs from 'node:fs'
import path from 'node:path'

const API_KEY = 'AIzaSyCfqeoe2A1wslwWONlbEVgW9XK9IrDAk3Q'
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/chunks-voicecloning-genshai/databases/(default)/documents/lessons'
const OUTPUT_DIR = path.resolve(process.cwd(), '@output')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function fetchLessonChunks(lessonId) {
  const url = `${FIRESTORE_BASE}/${lessonId}?key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch lesson ${lessonId}: ${res.statusText}`)
  }
  const data = await res.json()
  const rawValues = data.fields?.chunks?.arrayValue?.values || []
  return rawValues.map((v) => {
    const f = v.mapValue?.fields || {}
    return {
      chunkId: f.chunk_id?.stringValue || '',
      itemNumber: Number(f.item_number?.integerValue || 0),
      english: f.english?.stringValue || '',
      vietnamese: f.vietnamese?.stringValue || '',
      category: f.category?.stringValue || 'vocab',
      audioUrl: f.audio_url?.stringValue || null,
    }
  })
}

// Green Test: Hoàn thiện 1 câu hoàn chỉnh (Bilingual complete sentences), độ khó câu tăng theo CVR
function generateGreenTestPackage({ topicNumber, lessonId, lessonTitle, chunks }) {
  const packageCode = `G0${topicNumber}-9Q-Topic${topicNumber}-${lessonTitle.replace(/[^a-zA-Z0-9]/g, '')}`
  const title = `G0${topicNumber}-9Q-Topic${topicNumber}: ${lessonTitle} (Focus 12V - Complete Sentences)`
  const sessionCount = 3
  const itemsPerSession = 3
  const targetCpd = 12 // Volts
  const cciAmps = 4

  const sentenceTemplates = {
    1: [ // Topic 1: Orientation
      {
        session: 1, cvr: 2, level: 'A2 (Everyday Simple Sentence)',
        items: [
          {
            termVi: 'Cái bàn', termEn: 'Table',
            sentenceVi: 'Chiếc bàn gỗ nhỏ được đặt ngay ngắn ở góc phòng khách.',
            sentenceEn: 'The small wooden table is placed neatly in the corner of the living room.',
          },
          {
            termVi: 'Cái ly', termEn: 'Cup',
            sentenceVi: 'Tôi cầm chiếc ly nước trên tay và nhìn ra ngoài cửa sổ.',
            sentenceEn: 'I hold the water cup in my hand and look out the window.',
          },
          {
            termVi: 'Cà phê', termEn: 'Coffee',
            sentenceVi: 'Mùi hương cà phê thơm lừng buổi sáng lan tỏa khắp căn phòng.',
            sentenceEn: 'The rich aroma of morning coffee spreads throughout the entire room.',
          },
        ]
      },
      {
        session: 2, cvr: 3, level: 'B1 (Compound Sentence & Rhythm)',
        items: [
          {
            termVi: 'Cà phê đen', termEn: 'Black coffee',
            sentenceVi: 'Anh ấy thường thưởng thức một tách cà phê đen đậm đà trước khi bắt đầu công việc mỗi sáng.',
            sentenceEn: 'He often enjoys a rich cup of black coffee before starting his daily work in the morning.',
          },
          {
            termVi: 'Bàn nhựa', termEn: 'Plastic table',
            sentenceVi: 'Chúng tôi ngồi quanh chiếc bàn nhựa ngoài hiên để cùng nhau trò chuyện rôm rả.',
            sentenceEn: 'We sat around the plastic table on the porch to enjoy lively conversations together.',
          },
          {
            termVi: 'Phải', termEn: 'Have to',
            sentenceVi: 'Tất cả học viên phải tập trung chú ý và nhắc lại câu thật dứt khoát theo nhịp điệu.',
            sentenceEn: 'All learners have to pay close attention and repeat the sentence decisively with the rhythm.',
          },
        ]
      },
      {
        session: 3, cvr: 4, level: 'B2/C1 (Complex Sentence & Sustained Fluidity)',
        items: [
          {
            termVi: 'Ly bự', termEn: 'Big cup',
            sentenceVi: 'Mặc dù lịch trình làm việc rất bận rộn, cô ấy vẫn kịp chuẩn bị một ly bự trà thảo mộc để duy trì sự tỉnh táo suốt cả ngày.',
            sentenceEn: 'Despite having a very demanding schedule, she still prepared a big cup of herbal tea to sustain her alertness throughout the day.',
          },
          {
            termVi: 'Cà phê tuyệt vời của tôi', termEn: 'My amazing coffee',
            sentenceVi: 'Sau nhiều lần cải tiến công thức rang xay đặc biệt, đây thực sự là ly cà phê tuyệt vời của tôi mang đậm hương vị nguyên bản.',
            sentenceEn: 'Following numerous refinements to the distinctive roasting formula, this is genuinely my amazing coffee boasting authentic rich flavor.',
          },
          {
            termVi: 'Tập trung nhịp điệu', termEn: 'Rhythm focus',
            sentenceVi: 'Khi đối mặt với áp lực thời gian cao, người học cần duy trì sự tập trung tuyệt đối để phát âm toàn bộ câu mà không ngắt quãng.',
            sentenceEn: 'When confronted with intense time pressure, learners must maintain absolute focus to articulate the entire sentence without hesitation.',
          },
        ]
      },
    ],
    2: [ // Topic 2: How to survive
      {
        session: 1, cvr: 2, level: 'A2 (Everyday Simple Sentence)',
        items: [
          {
            termVi: 'Uống', termEn: 'Drink',
            sentenceVi: 'Hãy uống đủ nước mỗi ngày để giữ cho cơ thể luôn tỉnh táo và khỏe mạnh.',
            sentenceEn: 'Drink plenty of fresh water every day to keep your body refreshed and healthy.',
          },
          {
            termVi: 'Đặt', termEn: 'Put',
            sentenceVi: 'Cô ấy cẩn thận đặt các dụng cụ sinh tồn vào trong ba lô chống nước.',
            sentenceEn: 'She carefully put the essential survival tools inside the waterproof backpack.',
          },
          {
            termVi: 'Nghĩ', termEn: 'Think',
            sentenceVi: 'Tôi nghĩ thời tiết trong rừng nhiệt đới có thể thay đổi rất bất ngờ vào buổi chiều.',
            sentenceEn: 'I think the weather in the tropical forest can change very abruptly in the afternoon.',
          },
        ]
      },
      {
        session: 2, cvr: 3, level: 'B1 (Compound Sentence & Rhythm)',
        items: [
          {
            termVi: 'Thích', termEn: 'Like',
            sentenceVi: 'Nếu bạn thích đi dã ngoại ở nơi hoang sơ, bạn cần trang bị kỹ lưỡng các phương pháp định vị phương hướng.',
            sentenceEn: 'If you like trekking in remote wilderness, you need to thoroughly prepare reliable directional navigation methods.',
          },
          {
            termVi: 'Sẽ', termEn: 'Will',
            sentenceVi: 'Đội cứu hộ sẽ nhanh chóng nhận diện tín hiệu cấp cứu và tiếp cận địa điểm của bạn an toàn.',
            sentenceEn: 'The rescue team will promptly detect the distress signal and reach your exact location safely.',
          },
          {
            termVi: 'Phải', termEn: 'Have to',
            sentenceVi: 'Để sống sót trong điều kiện khắc nghiệt, chúng ta phải giữ bình tĩnh và phân bổ nguồn lương thực hợp lý.',
            sentenceEn: 'To survive in severe conditions, we have to stay calm and ration our food supplies reasonably.',
          },
        ]
      },
      {
        session: 3, cvr: 4, level: 'B2/C1 (Complex Sentence & Sustained Fluidity)',
        items: [
          {
            termVi: 'Kỹ năng sinh tồn', termEn: 'Survival skill',
            sentenceVi: 'Khả năng giữ vững bình tĩnh và áp dụng linh hoạt các kỹ năng sinh tồn cơ bản chính là yếu tố then chốt quyết định sự sống còn.',
            sentenceEn: 'The capacity to stay composed and adaptively apply core survival skills serves as the pivotal factor determining ultimate survival.',
          },
          {
            termVi: 'Định vị phương hướng', termEn: 'Terrain orientation',
            sentenceVi: 'Bất chấp địa hình hiểm trở và sương mù dày đặc che khuất tầm nhìn, đoàn thám hiểm vẫn kiên trì di chuyển theo đúng lộ trình ban đầu.',
            sentenceEn: 'Notwithstanding the treacherous terrain and dense fog obscuring visibility, the expedition persisted in advancing along their predefined route.',
          },
          {
            termVi: 'Ý chí sinh tồn', termEn: 'Will to survive',
            sentenceVi: 'Bằng cách điều hòa nhịp thở và bảo toàn thân nhiệt suốt đêm lạnh, người gặp nạn đã xuất sắc vượt qua giới hạn chịu đựng của bản thân.',
            sentenceEn: 'By regulating respiration and preserving core body warmth through the freezing night, the survivor successfully transcended personal endurance limits.',
          },
        ]
      },
    ],
  }

  const sessions = []
  let itemIndex = 0
  const topicData = sentenceTemplates[topicNumber] || sentenceTemplates[1]

  for (const sData of topicData) {
    const s = sData.session
    const sessionCvr = sData.cvr
    const sessionItems = []

    for (const item of sData.items) {
      itemIndex += 1
      const promptVi = item.sentenceVi
      const promptEn = item.sentenceEn

      sessionItems.push({
        itemOrder: itemIndex,
        sessionOrder: s,
        termVi: item.termVi,
        termEn: item.termEn,
        promptVi,
        promptEn,
        spokenScriptVi: promptVi,
        spokenScriptEn: promptEn,
        hasSsml: false,
        ssmlGap: null,
        tc: sessionCvr,
        lc: 1,
        tl: 1.0,
        measuredCvrOhm: sessionCvr,
        sentenceLevel: sData.level,
        cognitiveLoadDescription: `Complete sentence recall with continuous rhythm (TL=1.0, Level: ${sData.level})`,
      })
    }

    sessions.push({
      sessionOrder: s,
      title: `Session ${s}: Focus Sprint (${sData.level})`,
      targetCvrOhm: sessionCvr,
      cciAmps,
      cpdVoltage: sessionCvr * cciAmps,
      itemsCount: sessionItems.length,
      items: sessionItems,
      sessionIntroScript: {
        vi: `Chào mừng bạn đến với phiên ${s}. Mỗi câu hỏi là một câu hoàn chỉnh theo cấp độ ${sData.level}. Hãy đọc liền mạch và dứt khoát không ngập ngừng.`,
        en: `Welcome to Session ${s}. Each prompt is a complete sentence at ${sData.level}. Articulate the entire sentence with continuous, decisive rhythm.`,
      },
    })
  }

  return {
    packageCode,
    title,
    testType: 'GREEN',
    archetype: 'Focus (Đo lường độ tập trung & nhịp điệu khi đọc hoàn chỉnh 1 câu)',
    topicNumber,
    lessonId,
    lessonTitle,
    targetCpdVoltage: targetCpd,
    totalSessions: sessionCount,
    totalQuestions: sessionCount * itemsPerSession,
    itemsPerSession,
    sentenceStructureRule: 'Hoàn thiện 1 câu hoàn chỉnh song ngữ. Tăng dần độ dài và độ phức tạp theo CVR (A2 -> B1 -> B2/C1). Không dùng SSML bẫy.',
    audioFlow: {
      packageStart: {
        vi: `Chào mừng bạn đến với bài kiểm tra Green Test ${packageCode}. Bạn sẽ lắng nghe và hoàn thiện các câu trọn vẹn để đo lường chỉ số Focus và nhịp điệu phát âm.`,
        en: `Welcome to Green Test ${packageCode}. You will listen and vocalize complete sentences to measure your Focus index and fluent sentence pacing.`,
      },
      packageEnd: {
        vi: `Chúc mừng bạn đã hoàn thành trọn vẹn bài kiểm tra Green Test. Toàn bộ dữ liệu phản xạ câu hoàn chỉnh đã được lưu trữ thành công.`,
        en: `Congratulations on completing the Green Test assessment. All complete-sentence fluency and latency data have been successfully recorded.`,
      },
    },
    sessions,
  }
}

// Red Test: Ghép đa cụm từ với cấu trúc từ và loại bẫy (Hint Types) HOÀN TOÀN KHÁC NHAU cho từng câu
function generateRedTestPackage({ topicNumber, lessonId, lessonTitle }) {
  const packageCode = `R0${topicNumber - 2}-9Q-Topic${topicNumber}-56V`
  const title = `R0${topicNumber - 2}-9Q-Topic${topicNumber}: ${lessonTitle} (Awareness 56V - Multi-Type Traps)`
  const sessionCount = 3
  const itemsPerSession = 3
  const targetCpd = 56 // Volts
  const cciAmps = 8

  // Dữ liệu bẫy nhận thức đa dạng (9 cấu trúc & 9 loại hint hoàn toàn khác nhau cho mỗi topic)
  const redSpecifications = {
    3: [ // Topic 3: Animals & Contrast Descriptors
      {
        session: 1, cvr: 5, difficulty: 'Trap Level 1: Acoustic & Latency Modulation',
        items: [
          {
            trapType: 'Scale Contrast Trap (Đơn thể siêu to vs Cụm từ màu sắc nhỏ)',
            term1En: 'Elephant', term1Vi: 'Con voi',
            term2En: 'Black cat', term2Vi: 'Mèo mun',
            hintVi: 'Điều chỉnh trường năng lượng: Chuyển đổi dứt khoát từ danh từ thực thể lớn sang cụm miêu tả nhỏ sau khoảng ngắt 650ms.',
            hintEn: 'Scale contrast: Shift vocal energy decisively from the massive entity chunk to the descriptive minor chunk across the 650ms gap.',
          },
          {
            trapType: 'Phonetic Terminal Plosive Trap (Bẫy trượt âm cuối /g/ vs /t/)',
            term1En: 'Black dog', term1Vi: 'Chó mực',
            term2En: 'Black cat', term2Vi: 'Mèo mun',
            hintVi: 'Bật rõ âm đuôi /g/ ở vế đầu và /t/ ở vế sau; tuyệt đối không để quán tính lặp từ "Black" làm nuốt phụ âm cuối.',
            hintEn: 'Articulate terminal /g/ and /t/ plosives distinctly; prevent the repetitive "Black" modifier from swallowing final stops.',
          },
          {
            trapType: 'Acoustic Latency Hold (Kiềm chế phản xạ sớm qua khoảng lặng)',
            term1En: 'Monkey', term1Vi: 'Con khỉ',
            term2En: 'Chicken & duck', term2Vi: 'Gà và vịt',
            hintVi: 'Giữ vững sự điềm tĩnh qua khoảng lặng 650ms; không được vội vàng phát âm cụm liên từ trước khi khoảng ngắt chấm dứt.',
            hintEn: 'Hold through the 650ms acoustic silence; resist premature vocalization of the coordinate conjunction chunk.',
          },
        ]
      },
      {
        session: 2, cvr: 7, difficulty: 'Trap Level 2: Semantic Inversion & Coordinate Stress',
        items: [
          {
            trapType: 'Cognitive Semantic Clash (Đối đầu khái niệm dã thú quen thuộc)',
            term1En: 'Lion', term1Vi: 'Con sư tử',
            term2En: 'Tiger', term2Vi: 'Con cọp',
            hintVi: 'Tách bạch rõ ràng hai dã thú tương đồng; tránh xu hướng ghép tắt hay đảo vị trí của chuỗi thuật ngữ.',
            hintEn: 'Maintain strict mental boundaries between opposing predator archetypes; resist swapping their designated sequential order.',
          },
          {
            trapType: 'Structural Coordination Trap (Cặp vật nuôi kép vs Đơn thú âm xát)',
            term1En: 'Dog & cat', term1Vi: 'Chó và mèo',
            term2En: 'Snake', term2Vi: 'Con rắn',
            hintVi: 'Xử lý trơn tru liên từ "&" ở vế trước, sau đó bật âm xát /s/ sắc nét ở vế sau mà không bị ngắc ngứ.',
            hintEn: 'Smoothly navigate the coordinate "&" in the opening phrase, then deliver a sharp initial sibilant on the closing term.',
          },
          {
            trapType: 'Familiarity Suppression Trap (Ức chế quán tính khẩu ngữ)',
            term1En: 'Cow', term1Vi: 'Con bò',
            term2En: 'Chicken & duck', term2Vi: 'Gà và vịt',
            hintVi: 'Ức chế thói quen liên tưởng thành ngữ dân gian; phát âm chuẩn xác từng âm vị theo đúng chuỗi tín hiệu.',
            hintEn: 'Suppress colloquial associative priming; vocalize each chunk according to exact acoustic boundaries.',
          },
        ]
      },
      {
        session: 3, cvr: 8, difficulty: 'Trap Level 3: Syllabic Differential & Peak Resistance',
        items: [
          {
            trapType: 'Syllabic Rhythm Differential (Đơn âm tiết xát sang Ba âm tiết trọng âm)',
            term1En: 'Snake', term1Vi: 'Con rắn',
            term2En: 'Elephant', term2Vi: 'Con voi',
            hintVi: 'Chuyển đổi nhịp thở từ đơn âm tiết ngắn sang đa âm tiết ba nhịp (el-e-phant) ngay sau độ trễ 650ms.',
            hintEn: 'Transition breath control rapidly from the monosyllabic sibilant to the tri-syllabic stress pattern after the pause.',
          },
          {
            trapType: 'Categorical Shift Resistance (Chuyển vùng nhận thức gia đình sang hoang dã)',
            term1En: 'Black dog', term1Vi: 'Chó mực',
            term2En: 'Lion', term2Vi: 'Con sư tử',
            hintVi: 'Chuyển dịch tức thì từ trường thú cưng gia đình sang biểu tượng hoang dã; giữ trọng âm đều ở cả hai vế.',
            hintEn: 'Shift immediately from domestic pet attributes to wild predator terminology; maintain balanced lexical stress.',
          },
          {
            trapType: 'Peak Cognitive Voltage Challenge (Thử thách điện thế nhận thức 56V)',
            term1En: 'Tiger', term1Vi: 'Con cọp',
            term2En: 'Monkey', term2Vi: 'Con khỉ',
            hintVi: 'Tại mức điện áp thử thách cao nhất (56V), kiểm soát hoàn toàn phản xạ kiềm chế và phát âm chuẩn xác cả hai vế.',
            hintEn: 'At peak 56V cognitive challenge, control respiratory tension and articulate the full paired sequence without hesitation.',
          },
        ]
      },
    ],
    4: [ // Topic 4: Hitchhiker, Venues & Logistics
      {
        session: 1, cvr: 5, difficulty: 'Trap Level 1: Facility-Action & Spatial Switching',
        items: [
          {
            trapType: 'Spatial Facility vs Transactional Verb Phrase (Địa điểm vs Hành động)',
            term1En: 'Airport', term1Vi: 'Sân bay',
            term2En: 'Book 2 tickets', term2Vi: 'Đặt 2 vé',
            hintVi: 'Chuyển đổi tư duy tức thì từ thực thể không gian công cộng sang hành động giao dịch có định lượng.',
            hintEn: 'Transition mental focus immediately from a spatial infrastructure noun to a quantified transactional action phrase.',
          },
          {
            trapType: 'Commercial Duality Shift (Tài chính công vụ vs Dịch vụ kép)',
            term1En: 'Bank', term1Vi: 'Ngân hàng',
            term2En: 'Restaurant & hotel', term2Vi: 'Nhà hàng & khách sạn',
            hintVi: 'Xử lý sự biến đổi nhịp điệu từ danh từ đơn sắc sang cụm liên từ dịch vụ phức hợp không nuốt từ.',
            hintEn: 'Handle the tempo expansion from a single financial noun to a compound hospitality coordinate without clipping.',
          },
          {
            trapType: 'Temporal Anchor to Sequential Transition (Mốc thời gian kép vs Từ nối)',
            term1En: 'On Sunday and in May', term1Vi: 'Vào chủ nhật và vào tháng năm',
            term2En: 'Then / after that', term2Vi: 'Sau đó',
            hintVi: 'Lắng nghe điểm kết thúc của cấu trúc giới từ kép; phát âm dứt khoát từ nối chuyển đoạn sau khoảng ngắt 650ms.',
            hintEn: 'Detect the boundary of the dual prepositional phrase; articulate the transitional discourse marker crisply after 650ms.',
          },
        ]
      },
      {
        session: 2, cvr: 7, difficulty: 'Trap Level 2: Syntactic Redundancy & Generation Shift',
        items: [
          {
            trapType: 'Lexical Redundancy Suppression (Khử lặp từ vựng quán tính)',
            term1En: 'Church', term1Vi: 'Nhà thờ',
            term2En: 'Go to the church', term2Vi: 'Đi nhà thờ',
            hintVi: 'Tránh vấp âm do hiện tượng lặp từ "church"; nhấn mạnh động từ hành động "Go to" ở vế thứ hai.',
            hintEn: 'Prevent lexical stuttering caused by the repeated root "church"; emphasize the kinetic vector "Go to" in the second chunk.',
          },
          {
            trapType: 'Generational Kinship Balance (Đối xứng nhịp điệu họ hàng hai thế hệ)',
            term1En: 'My brother and my sister', term1Vi: 'Anh tôi và chị tôi',
            term2En: 'My grandpa and my grandma', term2Vi: 'Ông tôi và bà tôi',
            hintVi: 'Duy trì nhịp điệu song song cân bằng giữa hai cụm liên từ dài; kiểm soát hơi thở không để hụt hơi ở vế sau.',
            hintEn: 'Maintain rhythmic symmetry across both extended kinship pairs; stabilize airflow to prevent trailing off.',
          },
          {
            trapType: 'Operational Divergence (Hành động có đối tượng sang Cơ sở tài chính)',
            term1En: 'Book 2 tickets', term1Vi: 'Đặt 2 vé',
            term2En: 'Bank', term2Vi: 'Ngân hàng',
            hintVi: 'Dừng phản xạ liên kết logic thông thường; chuyển đổi dứt khoát từ đặt vé sang địa điểm ngân hàng độc lập.',
            hintEn: 'Sever habitual narrative continuity; shift decisively from ticket booking to the independent banking institution.',
          },
        ]
      },
      {
        session: 3, cvr: 8, difficulty: 'Trap Level 3: Discourse Bridge & High Voltage Climax',
        items: [
          {
            trapType: 'Discourse Marker to Religious Action (Chuyển tiếp hành động tâm linh)',
            term1En: 'Then / after that', term1Vi: 'Sau đó',
            term2En: 'Go to the church', term2Vi: 'Đi nhà thờ',
            hintVi: 'Nối kết mượt mà từ trạng từ chuyển đoạn sang cụm động từ mà không để độ trễ nhận thức kéo dài quá 650ms.',
            hintEn: 'Seamlessly link the transitional adverbial to the directed action chunk without exceeding the 650ms threshold.',
          },
          {
            trapType: 'Logistics Spatial Contrast (Khu nghỉ dưỡng sang Ga hàng không)',
            term1En: 'Restaurant & hotel', term1Vi: 'Nhà hàng & khách sạn',
            term2En: 'Airport', term2Vi: 'Sân bay',
            hintVi: 'Phân định rõ ranh giới hai điểm đến du lịch; phát âm nguyên âm đôi /eə/ chuẩn xác trong "Airport".',
            hintEn: 'Differentiate between the accommodation domain and terminal departure; articulate the diphthong in "Airport" with precision.',
          },
          {
            trapType: 'Complex Chrono-Social Climax (Đỉnh cao tải nhận thức Thời gian - Xã hội)',
            term1En: 'On Sunday and in May', term1Vi: 'Vào chủ nhật và vào tháng năm',
            term2En: 'My brother and my sister', term2Vi: 'Anh tôi và chị tôi',
            hintVi: 'Tại đỉnh tải 56V, phát âm toàn vẹn chuỗi thời gian dài và chuỗi thành viên gia đình với độ chính xác tuyệt đối.',
            hintEn: 'At peak 56V load, articulate the extended temporal sequence followed by the familial coordinate with absolute fidelity.',
          },
        ]
      },
    ],
  }

  const sessions = []
  let itemIndex = 0
  const topicData = redSpecifications[topicNumber] || redSpecifications[3]

  for (const sData of topicData) {
    const s = sData.session
    const sessionCvr = sData.cvr
    const sessionItems = []

    for (const item of sData.items) {
      itemIndex += 1
      const combinedVi = `${item.term1Vi} ; ${item.term2Vi}`
      const combinedEn = `${item.term1En} ; ${item.term2En}`

      const ssmlVi = `<speak><s>${item.term1Vi}</s> <break time="650ms"/> <s>${item.term2Vi}</s></speak>`
      const ssmlEn = `<speak><s>${item.term1En}</s> <break time="650ms"/> <s>${item.term2En}</s></speak>`

      sessionItems.push({
        itemOrder: itemIndex,
        sessionOrder: s,
        trapType: item.trapType,
        termVi: combinedVi,
        termEn: combinedEn,
        term1: { en: item.term1En, vi: item.term1Vi },
        term2: { en: item.term2En, vi: item.term2Vi },
        promptVi: `[${item.trapType}] ${item.hintVi}`,
        promptEn: `[${item.trapType}] ${item.hintEn}`,
        spokenScriptVi: ssmlVi,
        spokenScriptEn: ssmlEn,
        hasSsml: true,
        ssmlGap: '650ms',
        tc: Math.round(sessionCvr / 2),
        lc: 2,
        tl: 2.0,
        measuredCvrOhm: sessionCvr,
        cognitiveLoadDescription: `Multi-term cognitive trap with 650ms latency gap (TL=2.0, Type: ${item.trapType})`,
      })
    }

    sessions.push({
      sessionOrder: s,
      title: `Session ${s}: Awareness Challenge (${sData.difficulty})`,
      targetCvrOhm: sessionCvr,
      cciAmps,
      cpdVoltage: sessionCvr * cciAmps,
      itemsCount: sessionItems.length,
      items: sessionItems,
      sessionIntroScript: {
        vi: `Chào mừng bạn đến với phiên bẫy nhận thức ${s}. CVR điện trở đạt ${sessionCvr} Ohm, dòng kích thích ${cciAmps} Ampe. Mỗi câu hỏi chứa một cấu trúc bẫy nhận thức hoàn toàn khác biệt.`,
        en: `Welcome to Awareness Session ${s}. Cognitive resistance is ${sessionCvr} Ohms with ${cciAmps} Amps drive. Each prompt presents an entirely distinct cognitive trap architecture.`,
      },
    })
  }

  return {
    packageCode,
    title,
    testType: 'RED',
    archetype: 'Awareness & Traps (Khả năng nhận biết bẫy, kiềm chế xung động phản xạ sai & phục hồi lỗi)',
    topicNumber,
    lessonId,
    lessonTitle,
    targetCpdVoltage: targetCpd,
    totalSessions: sessionCount,
    totalQuestions: sessionCount * itemsPerSession,
    itemsPerSession,
    sentenceStructureRule: 'Ghép đa cụm từ với cấu trúc từ và loại bẫy (Hint Types) HOÀN TOÀN KHÁC NHAU cho từng câu. Khoảng ngắt SSML 650ms giữa 2 cụm để đo thời gian kiềm chế phản xạ.',
    audioFlow: {
      packageStart: {
        vi: `Chào mừng bạn đến với Red Test ${packageCode}. Bài kiểm tra thử thách khả năng nhận biết bẫy và kiềm chế xung động qua các cấu trúc từ vựng đa dạng và khoảng trễ 650ms.`,
        en: `Welcome to Red Test ${packageCode}. This assessment tests your trap detection and inhibitory control across diverse lexical architectures with 650ms semantic latency.`,
      },
      packageEnd: {
        vi: `Hoàn thành xuất sắc bài kiểm tra Red Test 56V. Hệ số xử lý các loại bẫy nhận thức đa dạng của bạn đang được trích xuất.`,
        en: `Outstanding effort completing Red Test 56V. Your multi-trap detection and latency recovery metrics are now being compiled.`,
      },
    },
    sessions,
  }
}

async function run() {
  console.log('--- Fetching real vocabulary & Generating Sample Packages ---')

  const topics = [
    { num: 1, lessonId: 'level_a_day_1', title: 'Day 1 - Lesson 0 Orientation' },
    { num: 2, lessonId: 'level_a_day_2', title: 'Day 2 - Lesson 1 How to survive' },
    { num: 3, lessonId: 'level_a_day_3', title: "Day 3 - Lesson 2 What you'd like to do?" },
    { num: 4, lessonId: 'level_a_day_4', title: "Day 4 - Lesson 3 I'm a hitchhiker" },
  ]

  const packages = []

  // Topic 1: Green 1 (Complete Sentences)
  console.log(`Generating Topic 1 (${topics[0].lessonId}) - Complete Sentences Green Test...`)
  const chunks1 = await fetchLessonChunks(topics[0].lessonId)
  const pkg1 = generateGreenTestPackage({
    topicNumber: 1,
    lessonId: topics[0].lessonId,
    lessonTitle: topics[0].title,
    chunks: chunks1,
  })
  packages.push(pkg1)

  // Topic 2: Green 2 (Complete Sentences)
  console.log(`Generating Topic 2 (${topics[1].lessonId}) - Complete Sentences Green Test...`)
  const chunks2 = await fetchLessonChunks(topics[1].lessonId)
  const pkg2 = generateGreenTestPackage({
    topicNumber: 2,
    lessonId: topics[1].lessonId,
    lessonTitle: topics[1].title,
    chunks: chunks2,
  })
  packages.push(pkg2)

  // Topic 3: Red 1 (Multi-term Traps with Distinct Hint Types)
  console.log(`Generating Topic 3 (${topics[2].lessonId}) - Multi-term Traps with 9 Distinct Hint Types...`)
  const chunks3 = await fetchLessonChunks(topics[2].lessonId)
  const pkg3 = generateRedTestPackage({
    topicNumber: 3,
    lessonId: topics[2].lessonId,
    lessonTitle: topics[2].title,
  })
  packages.push(pkg3)

  // Topic 4: Red 2 (Multi-term Traps with Distinct Hint Types)
  console.log(`Generating Topic 4 (${topics[3].lessonId}) - Multi-term Traps with 9 Distinct Hint Types...`)
  const chunks4 = await fetchLessonChunks(topics[3].lessonId)
  const pkg4 = generateRedTestPackage({
    topicNumber: 4,
    lessonId: topics[3].lessonId,
    lessonTitle: topics[3].title,
  })
  packages.push(pkg4)

  // Save JSON files
  for (const pkg of packages) {
    const filename = `${pkg.packageCode}.json`
    const filePath = path.join(OUTPUT_DIR, filename)
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2), 'utf8')
    console.log(`✓ Saved ${filePath}`)
  }

  // Generate updated Markdown Summary
  const mdContent = `# Chunks LMS - Sample Test Packages Report (Complete Sentence & Multi-Type Traps)

Báo cáo phân tích chuyên sâu 4 bộ bài test mẫu chuẩn hóa theo đúng triết lý đo lường của **Chunks LMS**:

---

## 1. Bảng đối chiếu 4 bài test mẫu

| Mã bài test | Loại bài | Topic | Dữ liệu gốc (Firestore) | Target Voltage (CPD) | Quy chuẩn cấu trúc & Hint Type |
|---|---|---|---|---|---|
| **\`${pkg1.packageCode}\`** | **GREEN (Focus)** | Topic 1 | \`${pkg1.lessonTitle}\` | **12V** ($CVR \\times CCI = 3\\Omega \\times 4A$) | **100% Câu hoàn chỉnh (Complete Sentences)** phân tầng A2 $\\to$ B1 $\\to$ B2/C1. Đo sự tập trung & lưu loát nhịp điệu. $TL=1.0$. |
| **\`${pkg2.packageCode}\`** | **GREEN (Focus)** | Topic 2 | \`${pkg2.lessonTitle}\` | **12V** ($CVR \\times CCI = 3\\Omega \\times 4A$) | **100% Câu hoàn chỉnh sinh tồn**, nhịp thở liền mạch, $TL=1.0$. |
| **\`${pkg3.packageCode}\`** | **RED (Awareness)** | Topic 3 | \`${pkg3.lessonTitle}\` | **56V** ($CVR \\times CCI = 7\\Omega \\times 8A$) | **9 cấu trúc & 9 loại Hint bẫy nhận thức khác biệt hoàn toàn** (Scale Contrast, Plosives, Latency Hold, Sibilants, Syllabic...). SSML 650ms. |
| **\`${pkg4.packageCode}\`** | **RED (Awareness)** | Topic 4 | \`${pkg4.lessonTitle}\` | **56V** ($CVR \\times CCI = 7\\Omega \\times 8A$) | **9 cấu trúc & 9 loại Hint bẫy nhận thức khác biệt** (Facility-Action, Commercial Duality, Temporal Link, Redundancy Suppression...). SSML 650ms. |

---

## 2. Chi tiết 9 loại Hint Bẫy Nhận Thức khác nhau trong Red Test 1 (\`${pkg3.packageCode}\`)

Mỗi câu hỏi có **cấu trúc từ ghép khác nhau** và **chỉ dẫn nhận thức (Hint) chuyên biệt**, không trùng lặp:

1. **Câu 1**: *${pkg3.sessions[0].items[0].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[0].items[0].trapType}\`  
   - **Hint**: *"${pkg3.sessions[0].items[0].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[0].items[0].spokenScriptEn}\`
2. **Câu 2**: *${pkg3.sessions[0].items[1].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[0].items[1].trapType}\`  
   - **Hint**: *"${pkg3.sessions[0].items[1].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[0].items[1].spokenScriptEn}\`
3. **Câu 3**: *${pkg3.sessions[0].items[2].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[0].items[2].trapType}\`  
   - **Hint**: *"${pkg3.sessions[0].items[2].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[0].items[2].spokenScriptEn}\`
4. **Câu 4**: *${pkg3.sessions[1].items[0].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[1].items[0].trapType}\`  
   - **Hint**: *"${pkg3.sessions[1].items[0].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[1].items[0].spokenScriptEn}\`
5. **Câu 5**: *${pkg3.sessions[1].items[1].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[1].items[1].trapType}\`  
   - **Hint**: *"${pkg3.sessions[1].items[1].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[1].items[1].spokenScriptEn}\`
6. **Câu 6**: *${pkg3.sessions[1].items[2].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[1].items[2].trapType}\`  
   - **Hint**: *"${pkg3.sessions[1].items[2].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[1].items[2].spokenScriptEn}\`
7. **Câu 7**: *${pkg3.sessions[2].items[0].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[2].items[0].trapType}\`  
   - **Hint**: *"${pkg3.sessions[2].items[0].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[2].items[0].spokenScriptEn}\`
8. **Câu 8**: *${pkg3.sessions[2].items[1].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[2].items[1].trapType}\`  
   - **Hint**: *"${pkg3.sessions[2].items[1].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[2].items[1].spokenScriptEn}\`
9. **Câu 9**: *${pkg3.sessions[2].items[2].termEn}*  
   - **Loại bẫy**: \`${pkg3.sessions[2].items[2].trapType}\`  
   - **Hint**: *"${pkg3.sessions[2].items[2].promptVi}"*  
   - **SSML Audio**: \`${pkg3.sessions[2].items[2].spokenScriptEn}\`

---

## 3. Chi tiết 9 loại Hint Bẫy Nhận Thức khác nhau trong Red Test 2 (\`${pkg4.packageCode}\`)

1. **Câu 1**: *${pkg4.sessions[0].items[0].termEn}* $\to$ \`${pkg4.sessions[0].items[0].trapType}\`
2. **Câu 2**: *${pkg4.sessions[0].items[1].termEn}* $\to$ \`${pkg4.sessions[0].items[1].trapType}\`
3. **Câu 3**: *${pkg4.sessions[0].items[2].termEn}* $\to$ \`${pkg4.sessions[0].items[2].trapType}\`
4. **Câu 4**: *${pkg4.sessions[1].items[0].termEn}* $\to$ \`${pkg4.sessions[1].items[0].trapType}\`
5. **Câu 5**: *${pkg4.sessions[1].items[1].termEn}* $\to$ \`${pkg4.sessions[1].items[1].trapType}\`
6. **Câu 6**: *${pkg4.sessions[1].items[2].termEn}* $\to$ \`${pkg4.sessions[1].items[2].trapType}\`
7. **Câu 7**: *${pkg4.sessions[2].items[0].termEn}* $\to$ \`${pkg4.sessions[2].items[0].trapType}\`
8. **Câu 8**: *${pkg4.sessions[2].items[1].termEn}* $\to$ \`${pkg4.sessions[2].items[1].trapType}\`
9. **Câu 9**: *${pkg4.sessions[2].items[2].termEn}* $\to$ \`${pkg4.sessions[2].items[2].trapType}\`

---
*Tất cả 4 file JSON hoàn chỉnh đã được cập nhật tại: \`@output/\`*
`

  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), mdContent, 'utf8')
  console.log(`✓ Saved ${path.join(OUTPUT_DIR, 'README.md')}`)
  console.log('--- Successfully regenerated all 4 packages with Distinct Hint Types for Red! ---')
}

run().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
