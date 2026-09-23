import fs from 'node:fs'
import path from 'node:path'

function calculateCvr(tc, lc, tl) {
  return Number((tc * lc * tl).toFixed(1))
}
function calculateCpd(cvr, cci) {
  return Number((cvr * cci).toFixed(1))
}
function calculateCciFromCpd(targetCpd, cvr) {
  return Math.max(1, Math.round(targetCpd / cvr))
}

const GREEN_TEST_SESSION_LANGUAGES_7X3 = ['en', 'en', 'en', 'vi', 'vi', 'vi', 'en']
const RED_TEST_SESSION_LANGUAGES_7X3 = ['vi', 'vi', 'vi', 'en', 'en', 'en', 'en']
const RED_TEST_HINT_PROGRESSION_7X3 = [2, 3, 4, 2, 3, 4, 4]

const OUTPUT_DIR = path.resolve(process.cwd(), '@output')
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const IMPROV_PATH = path.resolve(
  process.cwd(),
  '../database-structure/chunks-class/public/data/improv_set_05.json'
)
const improvData = JSON.parse(fs.readFileSync(IMPROV_PATH, 'utf8'))
const itemsByHc = { 2: [], 3: [], 4: [], 5: [] }
for (const s of improvData.sessions) {
  const hc = s.hcTotal
  if (itemsByHc[hc]) itemsByHc[hc].push(...s.items)
}

// ---------------------------------------------------------------------------------
// 1. Curated, natural, and fluent eCommerce sentences for Green Test 1 (G01)
// Progression: S1: 10w, S2: 12w, S3: 14w, S4: 16w, S5: 18w, S6: 19-20w, S7: 21-22w (MAX 22)
// ---------------------------------------------------------------------------------
const GREEN_SENTENCES_G01 = [
  // Session 1: A2 Simple Sentence (CVR 2.0, Lang: EN) • Target 10 words
  {
    termVi: 'Ngành thương mại điện tử',
    termEn: 'E-commerce industry',
    promptVi: 'Ngành thương mại điện tử cạnh tranh rất khốc liệt.',
    promptEn: 'The e-commerce industry is fiercely competitive in modern markets.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Săn sale nửa đêm',
    termEn: 'Midnight deal hunting',
    promptVi: 'Nhiều người thức trắng đêm để săn sale giảm giá.',
    promptEn: 'Many shoppers stay up late for midnight discount sales.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Ví điện tử liên kết',
    termEn: 'Linked digital wallet',
    promptVi: 'Ví điện tử đã được liên kết với ngân hàng.',
    promptEn: 'The digital wallet is safely linked to bank accounts.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 2: A2 Simple Sentence (CVR 2.0, Lang: EN) • Target 12 words
  {
    termVi: 'Mức giá cạnh tranh',
    termEn: 'Competitive pricing',
    promptVi: 'Mức giá cạnh tranh luôn giúp cửa hàng thu hút khách mua.',
    promptEn: 'Competitive pricing always helps retail shops draw active customers.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Dạo ngắm đồ online',
    termEn: 'Casual window shopping',
    promptVi: 'Tôi thường dạo ngắm đồ trên mạng để giải tỏa căng thẳng.',
    promptEn: 'I often enjoy casual window shopping online to relieve stress.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Giỏ hàng đầy ắp',
    termEn: 'Overflowing shopping cart',
    promptVi: 'Giỏ hàng trực tuyến của cô ấy đầy ắp đồ giảm giá.',
    promptEn: 'Her virtual shopping cart is overflowing with great discounted products.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 3: B1 Compound Sentence (CVR 3.0, Lang: EN) • Target 14 words
  {
    termVi: 'Chiến dịch săn sale',
    termEn: 'Flash sale drive',
    promptVi: 'Chiến dịch săn sale được quảng bá rầm rộ nên khách đặt mua sớm.',
    promptEn: 'The flash sale was hyped up, so customers placed orders very early.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Thanh toán ví điện tử',
    termEn: 'E-wallet checkout',
    promptVi: 'Khi thanh toán bằng ví điện tử, bạn sẽ nhận được tiền hoàn ngay.',
    promptEn: 'When checking out with an e-wallet, you receive cashback instantly.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Sản phẩm trong giỏ hàng',
    termEn: 'Items in cart',
    promptVi: 'Bạn nên kiểm tra giỏ hàng cẩn thận khi sản phẩm còn đủ hàng.',
    promptEn: 'Check your shopping cart carefully while selected items are still in stock.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 4: B1 Compound Sentence (CVR 3.0, Lang: VI) • Target 16 words
  {
    termVi: 'Thanh toán không tiền mặt',
    termEn: 'Cashless payments',
    promptVi: 'Thanh toán không tiền mặt rất thuận tiện, nên người dùng ngày càng chuộng mua sắm.',
    promptEn: 'Cashless payments are very convenient, so consumers increasingly prefer shopping online.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Mã miễn phí vận chuyển',
    termEn: 'Free shipping coupon',
    promptVi: 'Cửa hàng tặng mã miễn phí vận chuyển, giúp khách nhanh chóng chốt thêm nhiều đơn.',
    promptEn: 'The store offers free shipping codes, helping buyers quickly place more orders.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Giao hàng hỏa tốc',
    termEn: 'Instant delivery',
    promptVi: 'Dịch vụ giao hàng hỏa tốc rất tốt, nhưng doanh nghiệp cần mở rộng mạng lưới.',
    promptEn: 'Instant delivery service is great, but companies need to expand their network.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 5: B2 Complex Sentence (CVR 4.0, Lang: VI) • Target 18 words
  {
    termVi: 'Tối ưu phễu bán hàng',
    termEn: 'Funnel optimization',
    promptVi: 'Dù chi phí quảng cáo tăng cao, việc tối ưu phễu bán hàng giúp tăng mạnh doanh thu.',
    promptEn: 'Although advertising costs have risen, sales funnel optimization helps significantly increase revenue.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Chương trình tri ân khách hàng',
    termEn: 'Loyalty rewards',
    promptVi: 'Nhờ áp dụng chương trình tri ân hấp dẫn, thương hiệu đã giữ chân được nhiều khách quen.',
    promptEn: 'By applying attractive loyalty programs, the brand successfully retained many regular customers.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Cơn sốt mua sắm',
    termEn: 'Shopping frenzy',
    promptVi: 'Khi cơn sốt mua sắm bùng nổ, các kỹ sư phải túc trực đêm để giữ máy chủ.',
    promptEn: 'When the shopping frenzy erupted, engineers monitored servers all night to keep them running.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 6: B2 Complex Sentence (CVR 4.0, Lang: VI) • Target 19-20 words
  {
    termVi: 'Tỉ lệ chuyển đổi đơn',
    termEn: 'Conversion rate',
    promptVi: 'Trong thương mại điện tử, tỉ lệ chuyển đổi là thước đo sống còn quyết định toàn bộ thành công.',
    promptEn: 'In e-commerce, the checkout conversion rate is a vital metric that determines overall business success.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Phí giao hàng quá mức',
    termEn: 'Express shipping fee',
    promptVi: 'Nếu người bán tính phí vận chuyển quá đắt đỏ, khách hàng sẽ lập tức từ bỏ giỏ hàng.',
    promptEn: 'If sellers charge excessive shipping fees, customers will immediately abandon their shopping carts.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Chính sách đổi trả minh bạch',
    termEn: 'Return guarantee',
    promptVi: 'Chính sách đổi trả bảy ngày không chỉ tạo dựng uy tín, mà còn giúp khách hàng rất an tâm.',
    promptEn: 'A seven-day return policy not only builds reputation, but also gives buyers great peace of mind.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 7: C1 Advanced Sustained Fluency (CVR 6.0, Lang: EN) • Target 21-22 words (MAX 22)
  {
    termVi: 'Cuộc chiến đốt tiền thị phần',
    termEn: 'Cash-burning war & market share',
    promptVi: 'Thị trường thương mại rất màu mỡ, nhưng nếu liên tục đốt tiền thì doanh nghiệp sẽ sớm cạn kiệt nguồn vốn.',
    promptEn: 'The retail market is lucrative, but continuous cash burning will inevitably drain an enterprise of capital reserves.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Phiên livestream bán hàng tương tác',
    termEn: 'Live shopping show & checkout velocity',
    promptVi: 'Việc tổ chức livestream bán hàng trực tiếp trên ứng dụng giúp thu hút khách mua và chốt đơn rất nhanh chóng.',
    promptEn: 'Hosting live sales streams directly on apps attracts shoppers and achieves remarkably rapid checkout speeds.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Chiến lược bán lẻ đa kênh',
    termEn: 'Omnichannel customer retention',
    promptVi: 'Để cạnh tranh trên thị trường số, các thương hiệu cần xây dựng mô hình bán lẻ đa kênh bền vững.',
    promptEn: 'To compete effectively in digital markets, retail brands must build sustainable omnichannel sales models.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
]

// ---------------------------------------------------------------------------------
// 2. Curated, natural, and fluent eCommerce sentences for Green Test 2 (G02)
// Progression: S1: 10w, S2: 12w, S3: 14w, S4: 16w, S5: 18w, S6: 19-20w, S7: 21-22w (MAX 22)
// ---------------------------------------------------------------------------------
const GREEN_SENTENCES_G02 = [
  // Session 1: A2 Simple Sentence (CVR 2.0, Lang: EN) • Target 10 words
  {
    termVi: 'Người tiêu dùng tùy hứng',
    termEn: 'Impulsive shopper',
    promptVi: 'Người mua tùy hứng thường chọn đồ theo cảm xúc.',
    promptEn: 'An impulsive shopper often picks items based on pure emotion.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Thị trường sôi động',
    termEn: 'Vibrant marketplace',
    promptVi: 'Thị trường bán lẻ này tăng trưởng vô cùng nhanh.',
    promptEn: 'This retail marketplace continues to grow at an extraordinary speed.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Quy trình thanh toán an toàn',
    termEn: 'Secure checkout process',
    promptVi: 'Quy trình thanh toán an toàn giúp bạn an tâm.',
    promptEn: 'A secure checkout process helps you feel completely confident.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 2: A2 Simple Sentence (CVR 2.0, Lang: EN) • Target 12 words
  {
    termVi: 'Theo dõi đơn hàng thời gian thực',
    termEn: 'Track package in real time',
    promptVi: 'Khách hàng dễ dàng theo dõi hành trình đơn trên điện thoại.',
    promptEn: 'Customers can easily track their package journey on mobile phones.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Đánh giá sản phẩm uy tín',
    termEn: 'Genuine product reviews',
    promptVi: 'Đọc nhận xét thực tế giúp chọn được cửa hàng uy tín.',
    promptEn: 'Reading genuine product reviews helps shoppers choose reputable online stores.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Mã giảm giá ưu đãi',
    termEn: 'Discount voucher code',
    promptVi: 'Đừng quên nhập mã giảm giá trước khi bạn xác nhận đơn.',
    promptEn: 'Do not forget to apply your discount voucher before confirming your order.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 3: B1 Compound Sentence (CVR 3.0, Lang: EN) • Target 14 words
  {
    termVi: 'Khách mua sắm tùy hứng',
    termEn: 'Impulsive shoppers',
    promptVi: 'Khách mua hàng rất thích quà tặng, nên cửa hàng tặng thêm quà nhỏ.',
    promptEn: 'Shoppers love promotional gifts, so the shop added small freebies to orders.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Người dạo ngắm đồ',
    termEn: 'Window shoppers',
    promptVi: 'Nhiều người chỉ ngắm đồ ban ngày, nhưng lại đặt mua vào ban đêm.',
    promptEn: 'Many people only browse items by day, but buy online at night.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Nền tảng mua sắm tích hợp',
    termEn: 'Integrated shopping platform',
    promptVi: 'Ứng dụng mua sắm tích hợp video giúp người mua tương tác dễ dàng.',
    promptEn: 'The shopping application integrates live video, helping buyers interact very easily.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 4: B1 Compound Sentence (CVR 3.0, Lang: VI) • Target 16 words
  {
    termVi: 'Nhà phân phối bán sỉ',
    termEn: 'Wholesale distributor',
    promptVi: 'Nhà phân phối bán sỉ ưu tiên số lượng, nhưng vẫn giữ giá rất cạnh tranh.',
    promptEn: 'The wholesale distributor prioritizes high volume, yet they still maintain very competitive pricing.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Tương tác trực tuyến đa kênh',
    termEn: 'Interactive live session',
    promptVi: 'Buổi tương tác trực tuyến rất đông, và cửa hàng đã bán sạch hết mọi thứ.',
    promptEn: 'The interactive live stream was crowded, and the shop completely sold out of everything.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Thông báo giảm giá sốc',
    termEn: 'Flash discount notification',
    promptVi: 'Hệ thống vừa gửi thông báo giảm giá, do đó người mua lập tức mở app.',
    promptEn: 'The system just sent discount notifications, so shoppers immediately opened the app.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 5: B2 Complex Sentence (CVR 4.0, Lang: VI) • Target 18 words
  {
    termVi: 'Cơn sốt mua sắm thương mại điện tử',
    termEn: 'E-commerce shopping fever',
    promptVi: 'Bởi vì các nhãn hàng tung ra nhiều khuyến mãi, lượng đơn hàng đã tăng vọt kỷ lục.',
    promptEn: 'Because retail brands rolled out massive promotions, order volume skyrocketed to record highs.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Bảo mật dữ liệu thanh toán',
    termEn: 'Payment data security',
    promptVi: 'Nếu sàn không bảo mật dữ liệu khách hàng, họ sẽ mất niềm tin từ người tiêu dùng.',
    promptEn: 'If platforms fail to secure customer data, they will lose the trust of modern consumers.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Tối ưu hóa hành trình khách hàng',
    termEn: 'Customer journey optimization',
    promptVi: 'Bằng cách gợi ý sản phẩm hợp sở thích, người bán có thể nâng cao giá trị đơn.',
    promptEn: 'By recommending items matching buyer preferences, merchants can raise average order values.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 6: B2 Complex Sentence (CVR 4.0, Lang: VI) • Target 19-20 words
  {
    termVi: 'Chiến lược tiếp thị liên kết',
    termEn: 'Affiliate marketing strategy',
    promptVi: 'Dù thị trường cạnh tranh gay gắt, tiếp thị liên kết vẫn là đòn bẩy tăng trưởng doanh số mạnh.',
    promptEn: 'Although market competition is fierce, affiliate marketing remains a powerful lever for sales growth.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Xử lý phản hồi tiêu cực',
    termEn: 'Reputation management',
    promptVi: 'Khi khách để lại đánh giá tiêu cực, nhân viên cần nhanh chóng giải quyết để bảo vệ uy tín.',
    promptEn: 'When buyers leave negative feedback, staff must quickly resolve issues to protect brand reputation.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Cá nhân hóa trải nghiệm mua sắm',
    termEn: 'Personalized shopping experience',
    promptVi: 'Áp dụng công nghệ cá nhân hóa giỏ hàng không chỉ làm khách hài lòng, mà còn tiết kiệm tiền.',
    promptEn: 'Employing smart personalization for shopping carts not only delights consumers, but also saves advertising budget.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 7: C1 Advanced Sustained Fluency (CVR 6.0, Lang: EN) • Target 21-22 words (MAX 22)
  {
    termVi: 'Hệ sinh thái thanh toán tích hợp',
    termEn: 'Seamless payment ecosystem',
    promptVi: 'Nhờ hệ thống thanh toán tiện lợi cùng giao hàng hỏa tốc, các sàn đã thay đổi thói quen người mua sắm.',
    promptEn: 'By establishing convenient payments alongside instant delivery, online platforms have reshaped consumer shopping habits.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Bảo toàn biên lợi nhuận',
    termEn: 'Profit margin preservation',
    promptVi: 'Dù các đợt giảm giá mang lại lượng khách lớn, doanh nghiệp giỏi luôn chú trọng bảo toàn biên lợi nhuận.',
    promptEn: 'Although discount waves attract large crowds, smart enterprises always focus on preserving their net profit margins.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Bán lẻ đa kênh bền vững',
    termEn: 'Sustainable omnichannel retailing',
    promptVi: 'Trong thời đại số, kết hợp cửa hàng và sàn trực tuyến giúp thương hiệu phát triển bền vững dài lâu.',
    promptEn: 'In the digital era, combining physical stores with online platforms helps retail brands grow sustainably long term.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
]

// ---------------------------------------------------------------------------------
// 3. Generator for Green Mini Test Package
// ---------------------------------------------------------------------------------
function generateGreenMiniTestPackage(packageIndex) {
  const sentenceList = packageIndex === 1 ? GREEN_SENTENCES_G01 : GREEN_SENTENCES_G02
  const packageCode = `G0${packageIndex}-21Q-Ecommerce-${packageIndex}`
  const title = `G0${packageIndex}-21Q-Ecommerce: E-commerce Market Dynamics & Shopping Reflex (Focus 12V)`
  const slug = `g0${packageIndex}-21q-ecommerce-${packageIndex}`
  const description = `Green Mini Test (7x3 - 21 Questions) with natural, fluent complete sentences, TL=1.0, progressive CVR curve, target 12V CPD, and per-session TTS presets from Improv Set 05.`
  const targetQuestions = 21
  const targetCpd = 12
  const sessionLayout = '7x3'
  const sessionLanguages = [...GREEN_TEST_SESSION_LANGUAGES_7X3]

  const greenCvrCurve = [2.0, 2.0, 3.0, 3.0, 4.0, 4.0, 6.0]
  const greenCciCurve = [6, 6, 4, 4, 3, 3, 2]

  const sections = []
  let globalItemNumber = 0

  for (let s = 1; s <= 7; s++) {
    const cvr = greenCvrCurve[s - 1]
    const cci = greenCciCurve[s - 1]
    const cpd = calculateCpd(cvr, cci)
    const tl = 1.0
    const lc = 1.0
    const tc = cvr
    const sessionLanguage = sessionLanguages[s - 1]
    const part = s <= 2 ? 1 : s <= 4 ? 2 : 3
    const sessionItems = []

    for (let i = 0; i < 3; i++) {
      globalItemNumber += 1
      const itemData = sentenceList[globalItemNumber - 1]
      const wordCountVi = itemData.promptVi.trim().split(/\s+/).length

      sessionItems.push({
        itemOrder: i + 1,
        globalItemNumber,
        chunkIds: [`g0${packageIndex}-chunk-${globalItemNumber}`],
        termVi: itemData.termVi,
        termEn: itemData.termEn,
        promptVi: itemData.promptVi,
        promptEn: itemData.promptEn,
        wordCountVi,
        sentenceLevel: itemData.level,
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
      introTextVi: `Session ${s}: Mức kháng trở ${cvr} Ohm, cường độ ${cci} Ampe. Mục tiêu 12V CPD. Phát âm câu hoàn chỉnh trôi chảy.`,
      introTextEn: `Session ${s}: Resistance ${cvr} Ohm, current ${cci} Amps. Target 12V CPD. Articulate complete sentence fluently.`,
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
        vi: 'Chào mừng em đến với bài kiểm tra Green Test eCommerce (Focus). Lắng nghe và hoàn thiện các câu hoàn chỉnh song ngữ để đo lường độ Tập Trung và nhịp điệu phát âm.',
        en: 'Welcome to the Green Test eCommerce assessment. Listen and articulate complete sentences to measure your Focus and speech rhythm.',
      },
      part_intro: {
        1: {
          vi: 'Bắt đầu Phần 1: Các câu đơn giản thường nhật về mua sắm và thanh toán.',
          en: 'Starting Part 1: Everyday simple sentences on retail and payments.',
        },
        2: {
          vi: 'Bắt đầu Phần 2: Mở rộng các câu ghép với liên từ và nhịp điệu dồn dập.',
          en: 'Starting Part 2: Compound sentences with connectives and steady tempo.',
        },
        3: {
          vi: 'Bắt đầu Phần 3: Thử thách câu phức thương mại điện tử chuyên sâu và hơi thở liền mạch.',
          en: 'Starting Part 3: Advanced complex sentences and sustained fluency.',
        },
      },
      package_end: {
        vi: 'Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra Green Test eCommerce 21Q! Em đã thể hiện sự tập trung và lưu loát rất xuất sắc.',
        en: 'Congratulations on completing the 21Q eCommerce Green Test! Excellent focus and continuous fluency.',
      },
    },
    sections,
    totalItems: globalItemNumber,
  }
}

// ---------------------------------------------------------------------------------
// 4. Red Test Hint Enrichment & Multi-Word Collocation Enforcement ("0 dùng từ đơn")
// ---------------------------------------------------------------------------------
const RED_HINT_FIXES = {
  nếu: { vi: 'nếu không cẩn thận', en: 'if not careful' },
  'thức trắng': { vi: 'thức trắng đêm', en: 'stay up late' },
  'tuy nhiên': { vi: 'tuy nhiên vậy', en: 'however nonetheless' },
  'trước đó': { vi: 'trước đó trước', en: 'prior to that' },
  'đồng thời': { vi: 'đồng thời cùng lúc', en: 'at the same time' },
  'trong khi': { vi: 'trong khi đó', en: 'at the same time' },
  'Khi nào': { vi: 'Bất cứ khi nào', en: 'Whenever it happens' },
  'nếu không': { vi: 'nếu không thì', en: 'otherwise failing that' },
  'hút khách': { vi: 'thu hút khách mua', en: 'draw more customers' },
  'do đó': { vi: 'do đó cho nên', en: 'for that reason' },
  'không bền lâu': { vi: 'không bền lâu dài', en: 'not sustainable long' },
  'mặc dù': { vi: 'mặc dù vậy', en: 'even though so' },
  'Vì sao': { vi: 'Lý do vì sao', en: 'The reason why' },
  'hơn nữa': { vi: 'hơn thế nữa', en: 'what is more' },
  'sau đó': { vi: 'sau đó liền', en: 'right after that' },
  'thay vào đó': { vi: 'thay vào đó', en: 'instead of that' },
  'xả stress': { vi: 'giải tỏa căng thẳng', en: 'relieve mental stress' },
  'chất đầy ắp': { vi: 'chất đầy ắp giỏ', en: 'packed full cart' },
  'tối ưu hóa': { vi: 'tối ưu hóa phễu', en: 'fully optimize funnel' },
  'tăng vọt': { vi: 'tăng vọt kỷ lục', en: 'skyrocket to records' },
  'sau cùng': { vi: 'sau cùng thì', en: 'in the end' },
  'bởi vì': { vi: 'bởi vì thế', en: 'due to that' },
  'tiếp theo': { vi: 'tiếp theo đó', en: 'moving forward next' },
  'Ở đâu': { vi: 'ở bất cứ đâu', en: 'anywhere at all' },
  'ví dụ': { vi: 'ví dụ như', en: 'for instance like' },
  'cho nên': { vi: 'cho nên vì thế', en: 'so that therefore' },
  'trái lại': { vi: 'trái lại hoàn toàn', en: 'in sharp contrast' },
  'miễn là': { vi: 'miễn là như vậy', en: 'as long as' },
}

function enrichMultiWordHint(hint) {
  let vi = hint.text.trim()
  let en = hint.translation.trim()

  if (RED_HINT_FIXES[vi]) {
    vi = RED_HINT_FIXES[vi].vi
    en = RED_HINT_FIXES[vi] ? RED_HINT_FIXES[vi].en : en
  }

  // Double check: zero single words in both languages
  if (vi.split(/\s+/).length < 2) {
    vi = `${vi} này`
  }
  if (en.split(/\s+/).length < 2) {
    en = `${en} now`
  }

  return {
    ...hint,
    text: vi,
    translation: en,
  }
}

// ---------------------------------------------------------------------------------
// 5. Generator for Red Mini Test Package
// ---------------------------------------------------------------------------------
function generateRedMiniTestPackage(packageIndex) {
  const offset = packageIndex === 1 ? 0 : 5
  const packageCode = `R0${packageIndex}-21Q-Ecommerce-56V-${packageIndex}`
  const title = `R0${packageIndex}-21Q-Ecommerce: E-commerce Market Dynamics & Consumer Reflexes (Awareness 56V)`
  const slug = `r0${packageIndex}-21q-ecommerce-56v-${packageIndex}`
  const description = `Red Mini Test (7x3 - 21 Questions) with multi-word cognitive collocations, SSML 650ms breaks, target 56V CPD, and per-session TTS presets from Improv Set 05.`
  const targetQuestions = 21
  const targetCpd = 56
  const sessionLayout = '7x3'
  const sessionLanguages = [...RED_TEST_SESSION_LANGUAGES_7X3]

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
    const lc = 1.15
    const tl = Number((2.0 + ((s - 1) / 6) * 1.0).toFixed(1))
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
      const rawHints = rawItem.hints.slice(0, hintCount)
      const hints = rawHints.map(enrichMultiWordHint)

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

// ---------------------------------------------------------------------------------
// 6. Execution & Export
// ---------------------------------------------------------------------------------
const g01 = generateGreenMiniTestPackage(1)
const g02 = generateGreenMiniTestPackage(2)
const r01 = generateRedMiniTestPackage(1)
const r02 = generateRedMiniTestPackage(2)

const packages = [g01, g02, r01, r02]

for (const pkg of packages) {
  const file = path.join(OUTPUT_DIR, `${pkg.packageCode}.json`)
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8')
  console.log(`✓ Saved ${file}`)
}

console.log('Successfully generated all 4 eCommerce mini test packages.')
