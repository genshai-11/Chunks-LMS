-- Canonical Pre-test EE65 package seed from Chunks Resource.xlsx
-- Generated from workbook sheets: Package-test, CCI, Chunks-resource - CVR_new.
-- Local/PR migration artifact: do not apply to remote production without Lucy's explicit approval.

with org as (
  select id as organization_id from public.organizations order by created_at nulls last, id limit 1
), canonical_cci(session_order, source_cci_id, cci_name, ampe, description, main_category) as (
  values
    (1, 'cci-001', 'Give it a shot', 2, 'Linear 1 on 1 as Blow', 'Blow'),
    (2, 'cci-002', 'Go with the flow', 2, 'Linear RPD-free as Flow', 'Flow'),
    (3, 'cci-003', 'Chunks on the go', 4, 'Linear chunking act as Chunks', 'Chunks'),
    (4, 'cci-004', 'Freeze', 4, 'Freeze your body with RPD-free or 1-on-1 sound', null),
    (5, 'cci-005', 'Robot', 6, 'Move your hands linearly 1-on-1 as Blow', 'Blow'),
    (6, 'cci-006', 'Taichi', 6, 'Move your hands nonstop freely as Flow', 'Flow'),
    (7, 'cci-007', 'Strike', 8, 'Strike a fixed n times as Chunks', 'Chunks'),
    (8, 'cci-008', 'Nuance Work', 8, 'Imitation game while maintaining nuances', null)
), package_sessions(session_order, test_name, package_description, source_cci_id) as (
  values
    (1, 'Test 01', 'Test đầu khóa ERE', 'cci-001'),
    (2, 'Test 02', 'Test đầu khóa ERE', 'cci-002'),
    (3, 'Test 03', 'Test đầu khóa ERE', 'cci-003'),
    (4, 'Test 04', 'Test đầu khóa ERE', 'cci-004'),
    (5, 'Test 05', 'Test đầu khóa ERE', 'cci-005'),
    (6, 'Test 06', 'Test đầu khóa ERE', 'cci-006'),
    (7, 'Test 07', 'Test đầu khóa ERE', 'cci-007'),
    (8, 'Test 08', 'Test đầu khóa ERE', 'cci-008')
), workbook_items(session_order, item_order, material, source_item_id, source_cci_id, source_cvr_id, term_vi, term_en, prompt_vi, prompt_en) as (
  values
    (1, 1, 'Day 2', 'Number 1', 'cci-001', 3, 'Cảnh sát giao thông', 'Traffic police', 'Cảnh sát giao thông đứng ở ngã tư mỗi buổi sáng.', 'Traffic police stand at the intersection every morning.'),
    (1, 2, 'Day 2', 'Number 2', 'cci-001', 3, 'Du lịch nước ngoài', 'Travel abroad / Travel overseas', 'Gia đình tôi thích du lịch nước ngoài vào mùa hè.', 'My family likes to travel abroad in the summer.'),
    (1, 3, 'Day 2', 'Number 3', 'cci-001', 3, 'Cửa hàng tiện lợi', 'Convenient store', 'Tôi mua sữa ở cửa hàng tiện lợi gần nhà.', 'I buy milk at the convenience store near my house.'),
    (1, 4, 'Day 2', 'Number 4', 'cci-001', 3, 'Gần đây (địa lý)', 'Nearby / Around here / Locally', 'Có một quán cà phê mới gần đây.', 'There is a new coffee shop nearby.'),
    (1, 5, 'Day 2', 'Number 5', 'cci-001', 3, 'Cà vạt', 'Tie', 'Anh ấy đeo cà vạt xanh khi đi làm.', 'He wears a blue tie to work.'),
    (1, 6, 'Day 2', 'Number 6', 'cci-001', 3, 'Đồ móc khóa', 'Keychain', 'Tôi treo chìa khóa xe vào đồ móc khóa nhỏ.', 'I hang my car keys on a small keychain.'),
    (1, 7, 'Day 2', 'Number 7', 'cci-001', 3, 'Tạt vào / ra một chút', 'Pop in / out', 'Tôi tạt vào một chút để mua bánh mì.', 'I pop in for a moment to buy some bread.'),
    (1, 8, 'Day 2', 'Number 8', 'cci-001', 3, 'Đón ai đó', 'Pick up sb', 'Tôi đến sân bay để đón bạn tôi.', 'I go to the airport to pick up my friend.'),
    (1, 9, 'Day 2', 'Number 9', 'cci-001', 3, 'Cho ai đó xuống', 'Drop sb off', 'Tài xế cho tôi xuống trước cổng công ty.', 'The driver drops me off in front of the company gate.'),
    (1, 10, 'Day 2', 'Number 10', 'cci-002', 3, 'Dầu gió', 'Medicated oil', 'Mẹ bôi dầu gió cho tôi khi tôi bị nhức đầu.', 'Mom applies medicated oil for me when I have a headache.'),
    (2, 1, 'Day 3', 'Number 1', 'cci-002', 5, 'Cái máy lạnh', 'AC / Air Conditioner', 'Cái máy lạnh trong phòng ngủ đang chạy rất êm.', 'The air conditioner in the bedroom is running very quietly.'),
    (2, 2, 'Day 3', 'Number 2', 'cci-002', 5, 'Cứ thoải mái', 'Freely / feel free', 'Bạn cứ thoải mái ngồi nghỉ ở phòng khách.', 'Please feel free to sit and relax in the living room.'),
    (2, 3, 'Day 3', 'Number 3', 'cci-002', 5, 'Kỹ sư trưởng', 'Chief engineer', 'Kỹ sư trưởng kiểm tra máy móc mỗi sáng.', 'The chief engineer checks the machines every morning.'),
    (2, 4, 'Day 3', 'Number 4', 'cci-002', 5, 'Kỹ năng và khả năng', 'Skill and ability', 'Kỹ năng và khả năng giao tiếp rất quan trọng.', 'Communication skills and abilities are very important.'),
    (2, 5, 'Day 3', 'Number 5', 'cci-002', 5, 'Thực tập sinh', 'Intern / trainee / probationer / apprentice', 'Thực tập sinh mới đang học cách viết email.', 'The new intern is learning how to write emails.'),
    (2, 6, 'Day 3', 'Number 6', 'cci-002', 5, 'Có lẽ', 'Perhaps / maybe / most likely', 'Có lẽ chiều nay sẽ mưa.', 'Perhaps it will rain this afternoon.'),
    (2, 7, 'Day 3', 'Number 7', 'cci-002', 5, 'Duyệt', 'Approve / give me a go-ahead', 'Sếp sẽ duyệt kế hoạch của chúng tôi hôm nay.', 'The boss will approve our plan today.'),
    (2, 8, 'Day 3', 'Number 8', 'cci-002', 5, 'Trợ lý', 'Assistant / supporter / right-hand man', 'Trợ lý của tôi đặt lịch họp mỗi tuần.', 'My assistant books meetings every week.'),
    (2, 9, 'Day 3', 'Number 9', 'cci-002', 5, 'Nổi tiếng', 'Famous / well-known / renowned', 'Quán này nổi tiếng vì cà phê ngon.', 'This shop is famous for its good coffee.'),
    (2, 10, 'Day 3', 'Number 10', 'cci-002', 5, 'Gã khổng lồ công nghệ', 'Tech giant / Big Tech', 'Gã khổng lồ công nghệ vừa ra mắt sản phẩm mới.', 'The tech giant just launched a new product.'),
    (3, 1, 'Day 5', 'Number 1', 'cci-003', 7, 'Dễ (kiếm tiền)', 'Easy money', 'Nhiều bạn nghĩ bán hàng online dễ kiếm tiền.', 'Many people think selling online is easy money.'),
    (3, 2, 'Day 5', 'Number 2', 'cci-003', 7, 'Hợp đồng', 'Contract', 'Tôi đọc kỹ hợp đồng trước khi ký.', 'I read the contract carefully before signing.'),
    (3, 3, 'Day 5', 'Number 3', 'cci-003', 7, 'Ký một cái hợp đồng', 'Sign a contract', 'Công ty vừa ký một cái hợp đồng lớn.', 'The company just signed a big contract.'),
    (3, 4, 'Day 5', 'Number 4', 'cci-003', 7, 'Trước tiên', 'First / firstly / first off', 'Trước tiên, chúng ta cần chuẩn bị tài liệu.', 'First, we need to prepare the documents.'),
    (3, 5, 'Day 5', 'Number 5', 'cci-003', 7, 'Thương lượng', 'Negotiate', 'Hai bên thương lượng về giá cả hôm qua.', 'The two sides negotiated the price yesterday.'),
    (3, 6, 'Day 5', 'Number 6', 'cci-003', 7, 'Ồn ào / to mồm', 'Noisy / loud-mouthed', 'Đường phố hôm nay thật ồn ào.', 'The streets are very noisy today.'),
    (3, 7, 'Day 5', 'Number 7', 'cci-003', 7, 'Đồng nghiệp', 'Coworker / colleague / office buddy', 'Đồng nghiệp giúp tôi hoàn thành công việc.', 'My colleagues help me finish the work.'),
    (3, 8, 'Day 5', 'Number 8', 'cci-003', 7, 'Thuyết trình', 'Present / do presentation', 'Tôi sẽ thuyết trình về dự án mới.', 'I will present the new project.'),
    (3, 9, 'Day 5', 'Number 9', 'cci-003', 7, 'Không màu / đen trắng', 'Colorless / black and white', 'Văn phòng in tài liệu đen trắng để tiết kiệm.', 'The office prints documents in black and white to save money.'),
    (3, 10, 'Day 5', 'Number 10', 'cci-003', 7, 'Vấn đề thiếu hụt nhân lực', 'Staff shortage / headcount problem', 'Vấn đề thiếu hụt nhân lực khiến dự án chậm lại.', 'The staff shortage problem is slowing the project down.'),
    (4, 1, 'Day 6', 'Number 1', 'cci-004', 9, 'Quá nhanh', '(Way) too fast', 'Xe chạy quá nhanh trên đường nhỏ, nên tôi cảm thấy lo lắng và nhắc tài xế giảm tốc độ lại.', 'The car was going too fast on the small road, so I felt worried and reminded the driver to slow down.'),
    (4, 2, 'Day 6', 'Number 2', 'cci-004', 9, 'Nhiều khi / có mấy lúc', 'Sometimes / once in a while / at times', 'Nhiều khi tôi cảm thấy mệt sau giờ làm, nhưng tôi vẫn cố gắng ở bên gia đình vào buổi tối.', 'Sometimes I feel tired after work, but I still try to spend time with my family in the evening.'),
    (4, 3, 'Day 6', 'Number 3', 'cci-004', 9, 'Tôi e là không', 'I''m afraid not', 'Khi sếp hỏi tôi có thể họp vào cuối tuần không, tôi e là không vì tôi đã có kế hoạch với gia đình.', 'When the boss asked if I could meet on the weekend, I''m afraid not because I already had plans with my family.'),
    (4, 4, 'Day 6', 'Number 4', 'cci-004', 9, '(Ý anh) là sao?', 'What''d you mean?', 'Nghe anh nói về thay đổi lịch trình, tôi chưa hiểu rõ nên hỏi lại ý anh là sao để tránh nhầm lẫn.', 'Hearing him talk about the schedule change, I did not quite understand, so I asked what he meant to avoid confusion.'),
    (4, 5, 'Day 6', 'Number 5', 'cci-004', 9, 'Phức tạp', 'Complicated / complex / like a mess', 'Công việc này khá phức tạp vì có nhiều bước, nên chúng ta cần chia nhỏ nhiệm vụ và làm cẩn thận từng phần.', 'This work is quite complicated because it has many steps, so we need to break down the tasks and do each part carefully.'),
    (4, 6, 'Day 6', 'Number 6', 'cci-004', 9, 'Mỗi 5 năm', 'Every 5 years', 'Công ty chúng tôi tổ chức một chuyến du lịch lớn mỗi 5 năm để cảm ơn nhân viên đã cống hiến lâu dài.', 'Our company organizes a big trip every five years to thank employees for their long-term dedication.'),
    (4, 7, 'Day 6', 'Number 7', 'cci-004', 9, 'Thông thường', 'Usually / often / always', 'Thông thường, tôi dậy sớm để tập thể dục, nhưng hôm nay tôi ngủ thêm vì đêm qua làm việc đến khuya.', 'Usually I wake up early to exercise, but today I slept in because I worked late last night.'),
    (4, 8, 'Day 6', 'Number 8', 'cci-004', 9, 'Bìa sách & gáy sách', 'Book cover & book spine', 'Trước khi in hàng loạt, nhân viên kiểm tra kỹ bìa sách và gáy sách để đảm bảo không có lỗi nào.', 'Before mass printing, the staff carefully checks the book cover and spine to make sure there are no errors.'),
    (4, 9, 'Day 6', 'Number 9', 'cci-004', 9, 'Tốt hơn là cậu nên…', 'You''d better… / You should...', 'Tốt hơn là cậu nên hoàn thành báo cáo trước thứ Sáu, nếu không chúng ta sẽ không kịp gửi cho khách hàng.', 'You had better finish the report before Friday, otherwise we will not have time to send it to the client.'),
    (4, 10, 'Day 6', 'Number 10', 'cci-004', 9, 'Chọn', 'Select / choose / pick / go for', 'Có rất nhiều màu sơn đẹp, nhưng cuối cùng tôi chọn màu xanh nhạt vì nó làm căn phòng trông sáng hơn.', 'There were many beautiful paint colors, but in the end I chose light blue because it makes the room look brighter.'),
    (5, 1, 'Day 11', 'Number 1', 'cci-005', 11, 'Chuỗi cung ứng', 'Supply chain', 'Đại dịch đã làm gián đoạn chuỗi cung ứng toàn cầu, khiến nhiều công ty không nhận được nguyên liệu đúng hạn.', 'The pandemic disrupted the global supply chain, causing many companies to not receive materials on time.'),
    (5, 2, 'Day 11', 'Number 2', 'cci-005', 11, 'Thiếu hụt', 'Shortage / scarcity', 'Nhiều quốc gia đang đối mặt với tình trạng thiếu hụt lao động, đặc biệt là trong ngành y tế và xây dựng.', 'Many countries are facing a labor shortage, especially in the healthcare and construction industries.'),
    (5, 3, 'Day 11', 'Number 3', 'cci-005', 11, 'Đại dịch', 'Pandemic / epidemic', 'Đại dịch đã thay đổi hoàn toàn cách chúng ta làm việc, khi hàng triệu nhân viên chuyển sang làm việc tại nhà.', 'The pandemic completely changed the way we work, as millions of people switched to working from home.'),
    (5, 4, 'Day 11', 'Number 4', 'cci-005', 11, 'Chính phủ Trung Quốc', 'Chinese government', 'Chính phủ Trung Quốc đã công bố chính sách mới nhằm hỗ trợ các doanh nghiệp nhỏ bị ảnh hưởng bởi suy thoái kinh tế.', 'The Chinese government announced a new policy to support small businesses affected by the economic recession.'),
    (5, 5, 'Day 11', 'Number 5', 'cci-005', 11, 'đóng cửa', 'Shut down', 'Nhiều nhà hàng nhỏ buộc phải đóng cửa vì chi phí thuê mặt bằng tăng cao và lượng khách giảm sút.', 'Many small restaurants were forced to shut down because of high rent costs and fewer customers.'),
    (5, 6, 'Day 11', 'Number 6', 'cci-005', 11, 'Nỗi đau thật sự', 'Real pain point', 'Nỗi đau thật sự của doanh nghiệp không phải là thiếu vốn, mà là không tìm được nhân tài phù hợp.', 'The real pain point of businesses is not a lack of capital, but the inability to find suitable talent.'),
    (5, 7, 'Day 11', 'Number 7', 'cci-005', 11, 'Thượng Hải', 'Shanghai', 'Thượng Hải là một trong những trung tâm tài chính lớn nhất châu Á, thu hút nhiều nhà đầu tư nước ngoài.', 'Shanghai is one of the largest financial centers in Asia, attracting many foreign investors.'),
    (5, 8, 'Day 11', 'Number 8', 'cci-005', 11, 'Giá xăng', 'Gas prices', 'Giá xăng tăng mạnh trong những tháng gần đây, khiến nhiều gia đình phải cân nhắc kỹ hơn về việc đi lại.', 'Gas prices have risen sharply in recent months, forcing people to think more carefully about their travel.'),
    (5, 9, 'Day 11', 'Number 9', 'cci-005', 11, 'Báo Hàn', 'A Korean newspaper', 'Theo một báo Hàn, nền kinh tế khu vực đang phục hồi nhanh hơn dự kiến nhờ xuất khẩu tăng trưởng mạnh.', 'According to a Korean newspaper, the regional economy is recovering faster than expected thanks to strong export growth.'),
    (5, 10, 'Day 11', 'Number 10', 'cci-005', 11, 'Doanh số bán lẻ / bán sỉ', 'Retail / wholesale sales', 'Doanh số bán lẻ trong quý này tăng đáng kể, chủ yếu nhờ nhu cầu mua sắm trực tuyến ngày càng cao.', 'Retail sales this quarter increased significantly, mainly due to the growing demand for online shopping.'),
    (6, 1, 'Day 12', 'Number 1', 'cci-006', 13, 'Hợp cái job này', 'Fit (with) this job', 'Sau nhiều năm thử nhiều vị trí khác nhau, cuối cùng tôi nhận ra mình thực sự hợp cái job này.', 'After many years of trying different positions, I finally realized that I truly fit this job.'),
    (6, 2, 'Day 12', 'Number 2', 'cci-006', 13, 'Một cách lưu loát', 'Fluently / smoothly', 'Cô ấy có thể nói tiếng Anh một cách lưu loát nhờ kiên trì luyện tập mỗi ngày trong nhiều năm.', 'She can speak English fluently thanks to persistent daily practice over many years.'),
    (6, 3, 'Day 12', 'Number 3', 'cci-006', 13, 'Một cách mạch lạc', 'Coherently', 'Để thuyết phục khách hàng khó tính, bạn cần trình bày ý tưởng của mình một cách mạch lạc và rõ ràng.', 'To persuade demanding clients, you need to present your ideas coherently and clearly.'),
    (6, 4, 'Day 12', 'Number 4', 'cci-006', 13, 'Những cổ đông', 'Stakeholders / shareholders', 'Những cổ đông lớn của công ty yêu cầu ban lãnh đạo công khai báo cáo tài chính minh bạch hơn.', 'The company''s major shareholders demanded that the leadership disclose more transparent financial reports.'),
    (6, 5, 'Day 12', 'Number 5', 'cci-006', 13, 'Tổng đài Viettel', 'Viettel call center / switchboard', 'Khi gặp sự cố mạng, khách hàng có thể gọi tổng đài Viettel để được hỗ trợ kỹ thuật nhanh chóng.', 'When experiencing network issues, customers can call the Viettel call center for quick technical support.'),
    (6, 6, 'Day 12', 'Number 6', 'cci-006', 13, 'Dài dòng', 'Lengthy / wordy', 'Bài thuyết trình của anh ấy quá dài dòng và lặp lại nhiều ý, khiến khán giả cảm thấy mệt mỏi.', 'His presentation was too lengthy and repetitive, making the audience feel exhausted.'),
    (6, 7, 'Day 12', 'Number 7', 'cci-006', 13, 'Trung Đông', 'Middle East', 'Trung Đông là khu vực giàu tài nguyên dầu mỏ nhưng cũng đối mặt nhiều xung đột chính trị phức tạp.', 'The Middle East is a region rich in oil resources but also faces many complex political conflicts.'),
    (6, 8, 'Day 12', 'Number 8', 'cci-006', 13, 'Tôi sắp...', 'I''m about to... / I''m gonna...', 'Tôi sắp hoàn thành khóa học ngoại ngữ, và sau đó tôi dự định thi lấy chứng chỉ quốc tế.', 'I''m about to finish my language course, and after that I plan to take an international certificate exam.'),
    (6, 9, 'Day 12', 'Number 9', 'cci-006', 13, 'Buồn tẻ', 'Tedious / boring', 'Bộ phim này thực sự quá buồn tẻ và kéo dài, nên nhiều khán giả đã bỏ về ngay từ giữa chừng.', 'This movie was really too tedious and drawn out, so many viewers decided to leave the theater halfway through.'),
    (6, 10, 'Day 12', 'Number 10', 'cci-006', 13, '... có liên quan đến A', '... regarding/concerning A', 'Nếu bạn có bất kỳ thắc mắc nào có liên quan đến hợp đồng lao động, vui lòng liên hệ trực tiếp với phòng nhân sự.', 'If you have any questions regarding your employment contract, please contact the HR department directly.'),
    (7, 1, 'Day 14', 'Number 1', 'cci-007', 15, 'Chiến lược bóng đá', 'Football strategy', 'Huấn luyện viên đã thay đổi chiến lược bóng đá của đội, chuyển từ phòng ngự sang tấn công mạnh mẽ hơn.', 'The coach changed the team''s football strategy, shifting from defense to a more aggressive attack.'),
    (7, 2, 'Day 14', 'Number 2', 'cci-007', 15, 'Những câu lạc bộ bóng đá', 'Football clubs', 'Những câu lạc bộ bóng đá lớn thường đầu tư rất nhiều tiền để chiêu mộ các cầu thủ tài năng.', 'Big football clubs usually invest a lot of money to recruit talented players.'),
    (7, 3, 'Day 14', 'Number 3', 'cci-007', 15, '"Có tâm"', 'Dedicated', 'Một thầy giáo có tâm không chỉ truyền đạt kiến thức mà còn quan tâm đến tương lai của học sinh.', 'A dedicated teacher not only imparts knowledge but also cares about the students'' future.'),
    (7, 4, 'Day 14', 'Number 4', 'cci-007', 15, 'Còn khuya mới...', 'Nowhere near... / far from...', 'Đội bóng này còn khuya mới vô địch được giải đấu nếu cứ thi đấu thiếu tập trung như hiện nay.', 'This team is nowhere near winning the championship if they keep playing without focus like they are now.'),
    (7, 5, 'Day 14', 'Number 5', 'cci-007', 15, 'Bắt đầu từ số 0', 'Start from scratch / zero', 'Sau khi thất bại trong kinh doanh, anh ấy quyết định bắt đầu từ số 0 với một ý tưởng hoàn toàn mới.', 'After failing in business, he decided to start from scratch with a completely new idea.'),
    (7, 6, 'Day 14', 'Number 6', 'cci-007', 15, '... mọi thời đại', '... of all time', 'Nhiều chuyên gia coi anh ấy là cầu thủ vĩ đại nhất mọi thời đại của bóng đá thế giới.', 'Many experts consider him the greatest football player of all time in world football.'),
    (7, 7, 'Day 14', 'Number 7', 'cci-007', 15, '..., có thể nói vậy', '..., so to speak', 'Công việc này đòi hỏi sự sáng tạo, có thể nói vậy, vì chúng ta phải tìm ra giải pháp mới mỗi ngày.', 'This job requires creativity, so to speak, because we have to come up with new solutions every day.'),
    (7, 8, 'Day 14', 'Number 8', 'cci-007', 15, 'Quản trị', 'Management', 'Quản trị doanh nghiệp hiệu quả đòi hỏi nhà lãnh đạo phải cân bằng giữa lợi nhuận và phúc lợi nhân viên.', 'Effective business management requires leaders to balance profit and employee welfare.'),
    (7, 9, 'Day 14', 'Number 9', 'cci-007', 15, 'Nguyên tắc', 'Philosophy / principle', 'Công ty này hoạt động dựa trên nguyên tắc minh bạch, luôn đặt lợi ích của khách hàng lên hàng đầu.', 'This company operates on the principle of transparency, always putting the customer''s interests first.'),
    (7, 10, 'Day 14', 'Number 10', 'cci-007', 15, 'Cải thiện', 'Work on / improve', 'Để cải thiện kỹ năng giao tiếp, bạn nên luyện tập nói trước gương và ghi âm để tự đánh giá.', 'To improve your communication skills, you should practice speaking in front of a mirror and record yourself for self-evaluation.'),
    (8, 1, 'Day 15', 'Number 1', 'cci-008', 17, 'Ngấn mỡ bụng', 'Love handles', 'Nhiều nhân viên văn phòng vật lộn với ngấn mỡ bụng vì ngồi nhiều giờ mỗi ngày, hiếm khi vận động và thường ăn đồ ngọt.', 'Many office workers struggle with love handles because they sit for long hours every day and rarely exercise, even though their diets are full of sugar and fat.'),
    (8, 2, 'Day 15', 'Number 2', 'cci-008', 17, 'Không uống rượu bia (adj)', 'Teetotal', 'Mặc dù thường đi tiệc với đồng nghiệp, anh ấy vẫn không uống rượu bia, và bác sĩ nói thói quen này giúp tim mạch khỏe hơn nhiều.', 'Even though he often joins social parties with colleagues, he remains teetotal, and his doctor says this habit has greatly improved his overall heart health.'),
    (8, 3, 'Day 15', 'Number 3', 'cci-008', 17, 'Trào ngược dạ dày', 'Acid reflux', 'Trào ngược dạ dày phổ biến ở những ai làm việc căng thẳng, đặc biệt khi họ ăn không đúng giờ hoặc nằm ngay sau bữa ăn.', 'Acid reflux is very common among people who work under high stress, especially when they eat at irregular times or lie down right after their meals.'),
    (8, 4, 'Day 15', 'Number 4', 'cci-008', 17, 'Ợ nóng', 'Heartburn', 'Ợ nóng thường xuất hiện sau khi ăn đồ cay hoặc nhiều dầu mỡ, và nếu cảm giác này kéo dài nhiều tuần, bạn nên đi khám.', 'Heartburn often appears after eating spicy or greasy food, and if this burning feeling lasts for weeks, you should go see a doctor for a checkup.'),
    (8, 5, 'Day 15', 'Number 5', 'cci-008', 17, 'Đừng ăn khuya nữa', 'Stop eating at night / before bed', 'Chuyên gia dinh dưỡng khuyên đừng ăn khuya nữa nếu muốn giảm cân, vì ăn muộn khiến cơ thể tích mỡ thừa và ngủ kém hơn.', 'Nutrition experts say you should stop eating at night if you want to lose weight, because late meals make the body store extra fat and ruin your sleep.'),
    (8, 6, 'Day 15', 'Number 6', 'cci-008', 17, 'Đường huyết', 'Blood sugar', 'Giữ đường huyết ổn định đóng vai trò quan trọng trong phòng ngừa tiểu đường, đặc biệt với những ai có tiền sử gia đình hoặc thừa cân.', 'Keeping blood sugar levels stable plays a key role in preventing diabetes, especially for those with a family history of the disease or who are overweight.'),
    (8, 7, 'Day 15', 'Number 7', 'cci-008', 17, 'Ngộ độc thực phẩm', 'Food poisoning', 'Ngộ độc thực phẩm xảy ra khi bạn ăn đồ ôi thiu, nấu chưa kỹ hoặc bảo quản kém, gây buồn nôn, tiêu chảy và sốt nhẹ.', 'Food poisoning can happen when you eat spoiled, undercooked, or badly stored food, causing nausea, diarrhea, and a mild fever that lasts for two or three days.'),
    (8, 8, 'Day 15', 'Number 8', 'cci-008', 17, 'Sự trao đổi chất', 'Metabolism', 'Trao đổi chất của cơ thể chậm lại khi ta già đi, vì vậy việc duy trì thói quen tập luyện đều đặn ngày càng quan trọng.', 'The body''s metabolism tends to slow down as we get older, which is why keeping a regular exercise routine becomes more and more important each year.'),
    (8, 9, 'Day 15', 'Number 9', 'cci-008', 17, 'Đồ ăn vặt', 'Snacks / light meal', 'Ăn quá nhiều đồ ăn vặt chứa đầy muối, đường và chất béo không chỉ gây tăng cân mà còn tăng nguy cơ mắc bệnh mạn tính.', 'Eating too many snacks full of salt, sugar, and fat not only causes weight gain but also raises the risk of dangerous chronic diseases later in life.'),
    (8, 10, 'Day 15', 'Number 10', 'cci-008', 17, 'Ngay sau khi ăn', 'Shortly after the meal', 'Nhiều bạn có thói quen nằm ngay sau khi ăn, nhưng bác sĩ cảnh báo việc này tạo áp lực lên dạ dày và dễ gây trào ngược.', 'Many people have the habit of lying down shortly after the meal, but doctors warn this puts pressure on the stomach and easily causes acid reflux.')
)
, upsert_profile as (
  insert into public.cci_profiles (id, organization_id, name, version_label, status, description, created_by_user_id)
  select public.live_test_v2_deterministic_uuid('cci-profile:chunks-resource-ee65'), org.organization_id,
         'Chunks Resource EE65 CCI Profile', 'draft-v1', 'draft',
         'CCI catalog imported from Chunks Resource.xlsx for Pre-test EE65.', null::uuid
  from org
  on conflict (id) do update set name = excluded.name, version_label = excluded.version_label, description = excluded.description
  returning id, organization_id
), upsert_cci as (
  insert into public.cci_categories (id, profile_id, category_order, label, value, description, metadata)
  select public.live_test_v2_deterministic_uuid('cci-category:chunks-resource-ee65:' || canonical_cci.source_cci_id),
         upsert_profile.id, canonical_cci.session_order, canonical_cci.cci_name, canonical_cci.ampe, canonical_cci.description,
         jsonb_build_object('source', 'Chunks Resource.xlsx', 'sourceCciId', canonical_cci.source_cci_id, 'mainCategory', canonical_cci.main_category)
  from canonical_cci cross join upsert_profile
  on conflict (id) do update set category_order = excluded.category_order, label = excluded.label, value = excluded.value, description = excluded.description, metadata = excluded.metadata
  returning id, profile_id, category_order, label, value, metadata
), upsert_package as (
  insert into public.test_packages (id, organization_id, title, slug, description, created_by_user_id, source_metadata)
  select public.live_test_v2_deterministic_uuid('test-package:pre-test-ee65'), org.organization_id,
         'Pre-test', 'pre-test-ee65', 'Bài test đầu khóa EE65 — imported from Chunks Resource.xlsx.', null::uuid,
         jsonb_build_object('source', 'Chunks Resource.xlsx', 'packageId', 'Pre-test')
  from org
  on conflict (id) do update set title = excluded.title, slug = excluded.slug, description = excluded.description, source_metadata = excluded.source_metadata
  returning id
), upsert_version as (
  insert into public.test_package_versions (id, package_id, version_label, status, source_metadata, created_by_user_id)
  select public.live_test_v2_deterministic_uuid('test-package-version:pre-test-ee65:draft-v1'), upsert_package.id,
         'draft-v1', 'draft', jsonb_build_object('source', 'Chunks Resource.xlsx', 'sessions', 8, 'items', 80), null::uuid
  from upsert_package
  on conflict (id) do update set version_label = excluded.version_label, source_metadata = excluded.source_metadata
  returning id
), upsert_sections as (
  insert into public.test_sections (id, package_version_id, section_order, title, target_cvr_ohm, cci_profile_id, cci_category_id, cci_snapshot, intro_text_vi, intro_text_en, metadata)
  select public.live_test_v2_deterministic_uuid('test-section:pre-test-ee65:' || package_sessions.session_order::text),
         upsert_version.id, package_sessions.session_order, package_sessions.test_name, min(workbook_items.source_cvr_id),
         upsert_profile.id, cci.id,
         jsonb_build_object('source', 'Chunks Resource.xlsx', 'sourceCciId', package_sessions.source_cci_id, 'label', cci.label, 'value', cci.value, 'unit', 'Ampe', 'mainCategory', cci.metadata->>'mainCategory', 'targetCvrOhm', min(workbook_items.source_cvr_id)),
         'Session ' || package_sessions.session_order::text || '. ' || package_sessions.test_name || '. CCI ' || cci.label || '. CVR ' || min(workbook_items.source_cvr_id)::text || '.',
         'Session ' || package_sessions.session_order::text || '. ' || package_sessions.test_name || '. CCI ' || cci.label || '. CVR ' || min(workbook_items.source_cvr_id)::text || '.',
         jsonb_build_object('source', 'Chunks Resource.xlsx', 'packageDescription', package_sessions.package_description)
  from package_sessions
  join workbook_items on workbook_items.session_order = package_sessions.session_order
  cross join upsert_version
  cross join upsert_profile
  join upsert_cci cci on cci.metadata->>'sourceCciId' = package_sessions.source_cci_id
  group by upsert_version.id, upsert_profile.id, package_sessions.session_order, package_sessions.test_name, package_sessions.source_cci_id, package_sessions.package_description, cci.id, cci.label, cci.value, cci.metadata
  on conflict (id) do update set section_order = excluded.section_order, title = excluded.title, target_cvr_ohm = excluded.target_cvr_ohm, cci_profile_id = excluded.cci_profile_id, cci_category_id = excluded.cci_category_id, cci_snapshot = excluded.cci_snapshot, intro_text_vi = excluded.intro_text_vi, intro_text_en = excluded.intro_text_en, metadata = excluded.metadata
  returning id, package_version_id, section_order, target_cvr_ohm, cci_profile_id, cci_category_id
), upsert_items as (
  insert into public.test_items (id, package_version_id, section_id, item_order, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, tc, lc, tl, source_metadata)
  select public.live_test_v2_deterministic_uuid('test-item:pre-test-ee65:' || workbook_items.session_order::text || ':' || workbook_items.item_order::text),
         upsert_version.id, upsert_sections.id, workbook_items.item_order, workbook_items.material, workbook_items.source_item_id,
         workbook_items.term_vi, workbook_items.term_en, workbook_items.prompt_vi, workbook_items.prompt_en,
         workbook_items.source_cvr_id, 1, 1,
         jsonb_build_object('source', 'Chunks Resource.xlsx', 'sourceCciId', workbook_items.source_cci_id, 'sourceCvrId', workbook_items.source_cvr_id, 'sourceItemId', workbook_items.source_item_id, 'sourceSession', workbook_items.session_order)
  from workbook_items cross join upsert_version join upsert_sections on upsert_sections.section_order = workbook_items.session_order
  on conflict (id) do update set item_order = excluded.item_order, source_day = excluded.source_day, source_stt = excluded.source_stt, term_vi = excluded.term_vi, term_en = excluded.term_en, prompt_vi = excluded.prompt_vi, prompt_en = excluded.prompt_en, tc = excluded.tc, lc = excluded.lc, tl = excluded.tl, source_metadata = excluded.source_metadata
  returning id
)
insert into public.section_measurement_snapshots (id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, snapshot_metadata, created_by_user_id)
select public.live_test_v2_deterministic_uuid('section-measurement-snapshot:pre-test-ee65:' || upsert_sections.section_order::text),
       upsert_sections.id, upsert_sections.package_version_id, upsert_sections.target_cvr_ohm, upsert_sections.cci_profile_id, upsert_sections.cci_category_id,
       coalesce(upsert_cci.metadata->>'mainCategory', upsert_cci.label), upsert_cci.value,
       jsonb_build_object('source', 'Chunks Resource.xlsx', 'packageId', 'Pre-test', 'unit', 'Ampe'), null::uuid
from upsert_sections join upsert_cci on upsert_cci.id = upsert_sections.cci_category_id
where not exists (
  select 1 from public.section_measurement_snapshots existing
  where existing.id = public.live_test_v2_deterministic_uuid('section-measurement-snapshot:pre-test-ee65:' || upsert_sections.section_order::text)
);
