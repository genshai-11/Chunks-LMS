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
// Designed for Focus measurement: TL = 1.0, zero SSML pauses, natural bilingual flow
// ---------------------------------------------------------------------------------
const GREEN_SENTENCES_G01 = [
  // Session 1: A2 Simple Sentence (CVR 2.0, Lang: EN)
  {
    termVi: 'Ngành thương mại điện tử',
    termEn: 'E-commerce industry',
    promptVi: 'Ngành thương mại điện tử cạnh tranh rất khốc liệt trong thị trường hiện đại.',
    promptEn: 'The e-commerce industry is fiercely competitive in this modern market.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Săn sale nửa đêm',
    termEn: 'Midnight deal hunting',
    promptVi: 'Nhiều người mua sắm trực tuyến thức trắng đêm để săn sale nửa đêm.',
    promptEn: 'Many online shoppers stay up late for midnight deal hunting.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Ví điện tử liên kết',
    termEn: 'Linked digital wallet',
    promptVi: 'Ví điện tử của tôi đã được liên kết an toàn với tài khoản ngân hàng.',
    promptEn: 'My digital wallet is securely linked to my local bank account.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 2: A2 Simple Sentence (CVR 2.0, Lang: EN)
  {
    termVi: 'Mức giá cạnh tranh',
    termEn: 'Competitive pricing',
    promptVi: 'Mức giá cạnh tranh luôn giúp các cửa hàng trực tuyến thu hút khách mua.',
    promptEn: 'Competitive pricing always helps new online stores draw customers.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Dạo ngắm đồ online',
    termEn: 'Casual window shopping',
    promptVi: 'Tôi thường dạo ngắm đồ trên ứng dụng điện thoại để xả stress sau giờ làm.',
    promptEn: 'I often enjoy casual window shopping on mobile apps to unwind after work.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Giỏ hàng đầy ắp',
    termEn: 'Overflowing shopping cart',
    promptVi: 'Giỏ hàng trực tuyến của cô ấy đã đầy ắp các món đồ giảm giá theo mùa.',
    promptEn: 'Her virtual shopping cart is already overflowing with seasonal discounts.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 3: B1 Compound Sentence (CVR 3.0, Lang: EN)
  {
    termVi: 'Chiến dịch săn sale',
    termEn: 'Flash sale drive',
    promptVi: 'Nền tảng đã quảng bá rầm rộ chiến dịch săn sale, vì thế hàng triệu người tham gia từ sớm.',
    promptEn: 'The platform hyped up the flash sale drive, so millions of shoppers joined early.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Thanh toán ví điện tử',
    termEn: 'E-wallet checkout',
    promptVi: 'Bạn nên hoàn tất thanh toán bằng ví điện tử hôm nay, và bạn sẽ nhận được tiền hoàn ngay lập tức.',
    promptEn: 'You should complete your e-wallet checkout today, and you will get instant cashback.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Sản phẩm trong giỏ hàng',
    termEn: 'Items in cart',
    promptVi: 'Hãy kiểm tra kỹ các sản phẩm trong giỏ hàng, miễn là chúng vẫn còn đủ số lượng.',
    promptEn: 'Review the items in your cart carefully, as long as they are still in stock.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 4: B1 Compound Sentence (CVR 3.0, Lang: VI)
  {
    termVi: 'Thanh toán không tiền mặt',
    termEn: 'Cashless payments',
    promptVi: 'Phương thức thanh toán không tiền mặt rất tiện lợi, và người tiêu dùng ngày càng ưa chuộng nó.',
    promptEn: 'Cashless payments are supremely convenient, and modern consumers increasingly prefer them.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Mã miễn phí vận chuyển',
    termEn: 'Free shipping coupon',
    promptVi: 'Cửa hàng tặng kèm mã miễn phí vận chuyển, do đó khách hàng nhanh chóng đặt thêm nhiều đơn mới.',
    promptEn: 'The shop offers a free shipping coupon, so customers quickly place more orders.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Giao hàng hỏa tốc',
    termEn: 'Instant delivery',
    promptVi: 'Dịch vụ giao hàng hỏa tốc đang rất được yêu thích, nhưng công ty cần mở rộng trên toàn quốc.',
    promptEn: 'Instant delivery service is highly popular, but the company must expand nationwide.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 5: B2 Complex Sentence (CVR 4.0, Lang: VI)
  {
    termVi: 'Tối ưu phễu bán hàng',
    termEn: 'Funnel optimization',
    promptVi: 'Mặc dù chi phí quảng cáo tăng cao, việc tối ưu phễu chuyển đổi bài bản đã giúp doanh nghiệp nhân đôi doanh số.',
    promptEn: 'Although advertising costs have risen, systematically optimizing the sales funnel helped the brand double its revenue.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Chương trình tri ân khách hàng',
    termEn: 'Loyalty rewards',
    promptVi: 'Bằng cách cung cấp các chương trình tích điểm tri ân hấp dẫn, thương hiệu có thể giữ chân lượng khách hàng trung thành dài lâu.',
    promptEn: 'By providing attractive loyalty rewards, the brand can successfully retain its valuable customer base over the long run.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Cơn sốt mua sắm',
    termEn: 'Shopping frenzy',
    promptVi: 'Khi cơn sốt mua sắm nửa đêm bất ngờ bùng nổ, đội ngũ kỹ thuật phải ứng trực liên tục để hệ thống máy chủ không bị sập.',
    promptEn: 'When the midnight shopping frenzy suddenly erupted, the engineering team had to monitor continuously so that the servers would not crash.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 6: B2 Complex Sentence (CVR 4.0, Lang: VI)
  {
    termVi: 'Tỉ lệ chuyển đổi đơn',
    termEn: 'Conversion rate',
    promptVi: 'Trong kinh doanh thương mại điện tử, tỉ lệ chuyển đổi đơn hàng là thước đo sống còn quyết định toàn bộ hiệu quả tài chính.',
    promptEn: 'In e-commerce operations, the checkout conversion rate serves as the vital metric that determines overall financial viability.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Phí giao hàng quá mức',
    termEn: 'Express shipping fee',
    promptVi: 'Nếu thương hiệu áp đặt phí vận chuyển quá đắt đỏ, điều đó sẽ trở thành rào cản lớn khiến khách hàng lập tức bỏ quên giỏ hàng.',
    promptEn: 'If brands impose excessive express delivery fees, it becomes a major stumbling block that prompts immediate cart abandonment.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Chính sách đổi trả minh bạch',
    termEn: 'Return guarantee',
    promptVi: 'Chính sách đổi trả minh bạch trong bảy ngày không chỉ tạo dựng niềm tin vững chắc, mà còn giúp người mua hoàn toàn yên tâm chốt đơn.',
    promptEn: 'A transparent seven-day return guarantee not only establishes robust consumer trust, but also provides total peace of mind before checkout.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 7: C1 Advanced Sustained Fluency (CVR 6.0, Lang: EN)
  {
    termVi: 'Cuộc chiến đốt tiền thị phần',
    termEn: 'Cash-burning war & market share',
    promptVi: 'Mặc dù thị trường thương mại điện tử là một miếng bánh vô cùng màu mỡ, việc bước vào cuộc chiến đốt tiền không bền vững chắc chắn sẽ làm cạn kiệt nguồn vốn dự trữ.',
    promptEn: 'While the e-commerce arena remains a highly lucrative market, entering an unsustainable cash-burning war will inevitably drain your capital reserves.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Phiên livestream bán hàng tương tác',
    termEn: 'Live shopping show & checkout velocity',
    promptVi: 'Bằng cách tích hợp các phiên livestream bán hàng tương tác trực tiếp lên nền tảng, nhà bán lẻ có thể thu hút khách mua sắm tùy hứng và đạt tốc độ chốt đơn vượt bậc.',
    promptEn: 'By integrating interactive live shopping shows directly into the platform, retail merchants can captivate impulsive shoppers and achieve extraordinary checkout velocity.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Chiến lược giữ chân đa kênh',
    termEn: 'Omnichannel customer retention',
    promptVi: 'Để phát triển bền vững trước cuộc cạnh tranh giá khốc liệt, các thương hiệu bán lẻ phải xây dựng mô hình đa kênh giúp gia tăng lòng trung thành và bảo vệ biên lợi nhuận dài hạn.',
    promptEn: 'To thrive amid aggressive price competition, retail brands must cultivate an omnichannel presence that reinforces customer loyalty and safeguards long-term profit margins.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
]

// ---------------------------------------------------------------------------------
// 2. Curated, natural, and fluent eCommerce sentences for Green Test 2 (G02)
// ---------------------------------------------------------------------------------
const GREEN_SENTENCES_G02 = [
  // Session 1: A2 Simple Sentence (CVR 2.0, Lang: EN)
  {
    termVi: 'Người tiêu dùng tùy hứng',
    termEn: 'Impulsive shopper',
    promptVi: 'Người tiêu dùng tùy hứng thường thích chốt đơn nhanh vào các dịp lễ hội.',
    promptEn: 'An impulsive shopper often loves to buy on impulse during holiday sales.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Thị trường sôi động',
    termEn: 'Vibrant marketplace',
    promptVi: 'Thị trường sôi động này tiếp tục tăng trưởng nóng với hàng ngàn người bán mới.',
    promptEn: 'This vibrant marketplace continues to grow rapidly with thousands of new sellers.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Quy trình thanh toán an toàn',
    termEn: 'Secure checkout process',
    promptVi: 'Quy trình thanh toán an toàn và đơn giản khiến việc mua hàng online rất dễ chịu.',
    promptEn: 'A simple and secure checkout process makes online shopping very pleasant.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 2: A2 Simple Sentence (CVR 2.0, Lang: EN)
  {
    termVi: 'Theo dõi đơn hàng thời gian thực',
    termEn: 'Track package in real time',
    promptVi: 'Khách hàng có thể dễ dàng theo dõi hành trình bưu kiện theo thời gian thực trên điện thoại.',
    promptEn: 'Customers can easily track their package delivery in real time on mobile.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Đánh giá sản phẩm uy tín',
    termEn: 'Genuine product reviews',
    promptVi: 'Đọc đánh giá sản phẩm thực tế giúp tôi chọn được các cửa hàng năm sao uy tín.',
    promptEn: 'Reading genuine product reviews helps me choose trustworthy shops with five stars.',
    level: 'A2 (Simple Sentence)',
  },
  {
    termVi: 'Mã giảm giá ưu đãi',
    termEn: 'Discount voucher code',
    promptVi: 'Đừng quên nhập mã giảm giá ưu đãi trước khi tiến hành thanh toán cuối cùng.',
    promptEn: 'Do not forget to apply your discount voucher before making final payment.',
    level: 'A2 (Simple Sentence)',
  },

  // Session 3: B1 Compound Sentence (CVR 3.0, Lang: EN)
  {
    termVi: 'Khách mua sắm tùy hứng',
    termEn: 'Impulsive shoppers',
    promptVi: 'Khách mua hàng rất thích quà tặng kèm, vì vậy chúng tôi đã thêm ưu đãi vào đơn.',
    promptEn: 'Impulsive shoppers love freebies, so we added exclusive gifts to each order.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Người dạo ngắm đồ',
    termEn: 'Window shoppers',
    promptVi: 'Nhiều người dạo ngắm đồ trên phố ban ngày, rồi sau đó họ đặt mua trực tuyến vào ban đêm.',
    promptEn: 'Many people browse items in store windows during the day, and then they buy online at night.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Nền tảng mua sắm tích hợp',
    termEn: 'Integrated shopping platform',
    promptVi: 'Nền tảng mua sắm hiện nay tích hợp livestream, giúp người tiêu dùng tương tác trực tiếp với người bán.',
    promptEn: 'The modern shopping platform embeds live video, so buyers can interact directly with sellers.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 4: B1 Compound Sentence (CVR 3.0, Lang: VI)
  {
    termVi: 'Nhà phân phối bán sỉ',
    termEn: 'Wholesale distributor',
    promptVi: 'Nhà phân phối bán sỉ luôn ưu tiên số lượng lớn, nhưng họ vẫn duy trì mức giá rất cạnh tranh.',
    promptEn: 'The wholesale distributor prioritizes high volume, yet they still maintain very competitive rates.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Tương tác trực tuyến đa kênh',
    termEn: 'Interactive live session',
    promptVi: 'Buổi tương tác trực tuyến thu hút hàng ngàn lượt xem, và cửa hàng đã bán hết sạch hàng chỉ sau nửa giờ.',
    promptEn: 'The interactive live session attracted thousands of viewers, and the shop sold out within half an hour.',
    level: 'B1 (Compound Sentence)',
  },
  {
    termVi: 'Thông báo giảm giá sốc',
    termEn: 'Flash discount notification',
    promptVi: 'Ứng dụng vừa gửi thông báo giảm giá sốc, do đó người mua ngay lập tức mở điện thoại để săn đồ.',
    promptEn: 'The mobile app just pushed a flash discount notification, so buyers immediately checked their phones.',
    level: 'B1 (Compound Sentence)',
  },

  // Session 5: B2 Complex Sentence (CVR 4.0, Lang: VI)
  {
    termVi: 'Cơn sốt mua sắm thương mại điện tử',
    termEn: 'E-commerce shopping fever',
    promptVi: 'Bởi vì các thương hiệu tung ra hàng loạt mã khuyến mãi vào ngày hội mua sắm, lượng đơn hàng đã tăng vọt kỷ lục.',
    promptEn: 'Because top brands released numerous promotional codes on the shopping festival, order volume skyrocketed to record highs.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Bảo mật dữ liệu thanh toán',
    termEn: 'Payment data security',
    promptVi: 'Nếu nền tảng không đầu tư bảo mật thông tin thanh toán nghiêm ngặt, họ sẽ đánh mất hoàn toàn niềm tin từ cộng đồng người dùng.',
    promptEn: 'If platforms fail to invest in rigorous payment data security, they will completely lose the hard-earned trust of their users.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Tối ưu hóa hành trình khách hàng',
    termEn: 'Customer journey optimization',
    promptVi: 'Bằng cách phân tích hành vi duyệt web và đề xuất sản phẩm phù hợp, cửa hàng có thể nâng cao đáng kể giá trị trung bình trên mỗi đơn.',
    promptEn: 'By analyzing browsing habits and recommending relevant products, retailers can noticeably increase their average order value.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 6: B2 Complex Sentence (CVR 4.0, Lang: VI)
  {
    termVi: 'Chiến lược tiếp thị liên kết',
    termEn: 'Affiliate marketing strategy',
    promptVi: 'Mặc dù thị trường cạnh tranh vô cùng gay gắt, chiến lược tiếp thị liên kết thông minh đã tạo ra đòn bẩy tăng trưởng doanh số vượt bậc.',
    promptEn: 'Although market competition is exceptionally fierce, a smart affiliate marketing strategy created immense leverage for rapid revenue growth.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Xử lý phản hồi tiêu cực',
    termEn: 'Reputation management',
    promptVi: 'Khi phát sinh các đánh giá một sao từ khách hàng, bộ phận chăm sóc phải chủ động lắng nghe và giải quyết thỏa đáng để bảo vệ danh tiếng.',
    promptEn: 'When negative one-star reviews arise from dissatisfied buyers, customer support must proactively listen and resolve issues to protect brand reputation.',
    level: 'B2 (Complex Sentence)',
  },
  {
    termVi: 'Cá nhân hóa trải nghiệm mua sắm',
    termEn: 'Personalized shopping experience',
    promptVi: 'Việc áp dụng công nghệ trí tuệ nhân tạo để cá nhân hóa giỏ hàng không những làm hài lòng khách mua, mà còn tối ưu hóa chi phí tiếp thị.',
    promptEn: 'Employing artificial intelligence to personalize shopping carts not only delights consumers, but also substantially optimizes digital marketing expenditures.',
    level: 'B2 (Complex Sentence)',
  },

  // Session 7: C1 Advanced Sustained Fluency (CVR 6.0, Lang: EN)
  {
    termVi: 'Hệ sinh thái thanh toán tích hợp',
    termEn: 'Seamless payment ecosystem',
    promptVi: 'Nhờ xây dựng một hệ sinh thái thanh toán số liền mạch kết hợp giao hàng siêu tốc, các nền tảng bán lẻ hàng đầu đã tái định hình toàn bộ thói quen chi tiêu của người tiêu dùng.',
    promptEn: 'By engineering a seamless digital payment ecosystem paired with ultra-fast logistics, leading e-commerce platforms have fundamentally reshaped modern consumer spending habits.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Bảo toàn biên lợi nhuận',
    termEn: 'Profit margin preservation',
    promptVi: 'Mặc dù các đợt giảm giá kích cầu chớp nhoáng có thể mang lại lượng truy cập khổng lồ, những doanh nghiệp xuất sắc luôn ưu tiên bảo toàn biên lợi nhuận ròng và dòng tiền thực tế.',
    promptEn: 'Although aggressive promotional price cuts generate massive initial traffic surges, top enterprise merchants always prioritize sustainable cash flow and net margin preservation.',
    level: 'C1 (Advanced Sustained Fluency)',
  },
  {
    termVi: 'Chiến lược bán lẻ đa kênh bền vững',
    termEn: 'Sustainable omnichannel retailing',
    promptVi: 'Trong kỷ nguyên số hóa toàn diện, sự cộng hưởng nhịp nhàng giữa cửa hàng trải nghiệm thực tế và nền tảng mua sắm trực tuyến chính là chìa khóa mở ra tiềm năng tăng trưởng vô tận.',
    promptEn: 'In an era of ubiquitous digital commerce, establishing seamless synergy between physical flagship showrooms and online retail touchpoints unlocks unprecedented customer lifetime value.',
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

      sessionItems.push({
        itemOrder: i + 1,
        globalItemNumber,
        chunkIds: [`g0${packageIndex}-chunk-${globalItemNumber}`],
        termVi: itemData.termVi,
        termEn: itemData.termEn,
        promptVi: itemData.promptVi,
        promptEn: itemData.promptEn,
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
// 4. Generator for Red Mini Test Package
// ---------------------------------------------------------------------------------
function generateRedMiniTestPackage(packageIndex) {
  const offset = packageIndex === 1 ? 0 : 5
  const packageCode = `R0${packageIndex}-21Q-Ecommerce-56V-${packageIndex}`
  const title = `R0${packageIndex}-21Q-Ecommerce: E-commerce Market Dynamics & Consumer Reflexes (Awareness 56V)`
  const slug = `r0${packageIndex}-21q-ecommerce-56v-${packageIndex}`
  const description = `Red Mini Test (7x3 - 21 Questions) with cognitive traps, SSML 650ms breaks, target 56V CPD, and per-session TTS presets from Improv Set 05.`
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

// ---------------------------------------------------------------------------------
// 5. Execution & Export
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
