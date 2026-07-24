import csv

def main():
    csv_path = 'chunks-resourcce/Package-Green-test - Sessions list.csv'
    
    # Define Option 2 terms and sentences mapped by (session, term_vi)
    # For Session 1, we will map by item number since terms were originally blank
    s1_items = {
        1: {"term_vi": "Trà", "term_en": "Tea", "sent_vi": "Tôi thích uống một tách trà nóng vào buổi tối.", "sent_en": "I like to drink a cup of hot tea in the evening."},
        2: {"term_vi": "Sữa", "term_en": "Milk", "sent_vi": "Em bé uống một ly sữa ấm trước khi ngủ.", "sent_en": "The baby drinks a glass of warm milk before sleeping."},
        3: {"term_vi": "Hoa", "term_en": "Flower", "sent_vi": "Những bông hoa hồng đỏ đang nở đẹp trong vườn.", "sent_en": "The red roses are blooming beautifully in the garden."},
        4: {"term_vi": "Xe", "term_en": "Car", "sent_vi": "Chiếc xe máy mới của tôi chạy rất êm ái.", "sent_en": "My new motorbike runs very smoothly."},
        5: {"term_vi": "Đẹp", "term_en": "Beautiful", "sent_vi": "Bầu trời hôm nay rất xanh và thật là đẹp.", "sent_en": "The sky today is very blue and really beautiful."},
        6: {"term_vi": "Vui", "term_en": "Happy", "sent_vi": "Chúng tôi đã có một ngày đi chơi rất vui.", "sent_en": "We had a very happy day out."},
        7: {"term_vi": "Học", "term_en": "Learn / Study", "sent_vi": "Tôi muốn học thêm nhiều điều mới lạ mỗi ngày.", "sent_en": "I want to learn many new things every day."}
    }
    
    # Other sessions map by (session, term_vi)
    other_items = {
        # Session 2
        (2, "Duyệt"): {"sent_vi": "Giám đốc duyệt phương án quảng cáo mới rồi.", "sent_en": "The director approved the new advertising plan."},
        (2, "..., có thể nói vậy"): {"sent_vi": "Kế hoạch đã thất bại, có thể nói vậy.", "sent_en": "The plan has failed, so to speak."},
        (2, "Cải thiện"): {"sent_vi": "Chúng tôi muốn cải thiện chất lượng dịch vụ.", "sent_en": "We want to improve our service quality."},
        (2, "Quản trị"): {"sent_vi": "Anh ấy đang học quản trị nhân sự mới.", "sent_en": "He is studying new human resource management."},
        (2, "Nguyên tắc"): {"sent_vi": "Làm việc nhóm luôn cần có nguyên tắc chung.", "sent_en": "Teamwork always needs to have common principles."},
        (2, "Dài dòng"): {"sent_vi": "Bài thuyết trình dài dòng gây buồn ngủ quá.", "sent_en": "The lengthy presentation makes me so sleepy."},
        (2, "Dầu gió"): {"sent_vi": "Mẹ hay dùng dầu gió khi bị cảm lạnh.", "sent_en": "Mom often uses medicated oil when she catches a cold."},
        # Session 3
        (3, "Cái máy lạnh"): {"sent_vi": "Tôi mở cái máy lạnh vì thời tiết hôm nay quá oi bức.", "sent_en": "I turned on the air conditioner because the weather is too hot today."},
        (3, "Cứ thoải mái"): {"sent_vi": "Bạn cứ thoải mái chọn món ăn ưa thích trong thực đơn này.", "sent_en": "Please feel free to choose your favorite dish from this menu."},
        (3, "Kỹ sư trưởng"): {"sent_vi": "Chú tôi làm kỹ sư trưởng ở công trường xây dựng này.", "sent_en": "My uncle works as a chief engineer at this construction site."},
        (3, "Kỹ năng và khả năng"): {"sent_vi": "Khóa học này rèn luyện kỹ năng và khả năng tự học.", "sent_en": "This course trains self-study skills and abilities."},
        (3, "Thực tập sinh"): {"sent_vi": "Tôi hướng dẫn thực tập sinh mới dùng máy in văn phòng.", "sent_en": "I guide the new intern to use the office printer."},
        (3, "Có lẽ"): {"sent_vi": "Có lẽ chúng ta nên dời cuộc họp sang sáng mai nhé.", "sent_en": "Perhaps we should move the meeting to tomorrow morning."},
        (3, "Duyệt"): {"sent_vi": "Giám đốc đã duyệt đơn xin nghỉ phép của tôi chiều nay.", "sent_en": "The director approved my leave request this afternoon."},
        # Session 4
        (4, "Dễ (kiếm tiền)"): {"sent_vi": "Làm khảo sát trực tuyến không phải cách dễ kiếm tiền đâu bạn.", "sent_en": "Doing online surveys is not an easy way to make money, my friend."},
        (4, "Hợp đồng"): {"sent_vi": "Luật sư đang kiểm tra lại các điều khoản của bản hợp đồng.", "sent_en": "The lawyer is checking the terms of the contract again."},
        (4, "Ký một cái hợp đồng"): {"sent_vi": "Chúng tôi chuẩn bị ký một cái hợp đồng thuê nhà dài hạn.", "sent_en": "We are preparing to sign a long-term house rental contract."},
        (4, "Trước tiên"): {"sent_vi": "Trước tiên hãy rửa tay sạch sẽ trước khi bắt đầu bữa ăn.", "sent_en": "First of all, wash your hands clean before starting the meal."},
        (4, "Thương lượng"): {"sent_vi": "Người mua đang thương lượng với chủ nhà để giảm giá thuê phòng.", "sent_en": "The buyer is negotiating with the landlord to reduce room rent."},
        (4, "Ồn ào / to mồm"): {"sent_vi": "Tiếng xe cộ ồn ào ngoài đường làm em bé thức giấc rồi.", "sent_en": "The noisy traffic noise outside woke the baby up already."},
        (4, "Đồng nghiệp"): {"sent_vi": "Tôi vừa cùng đồng nghiệp ăn trưa tại quán ăn đối diện này.", "sent_en": "I just had lunch with my colleagues at the opposite restaurant."},
        # Session 5
        (5, "Nhiều khi / có mấy lúc"): {"sent_vi": "Nhiều khi tôi thấy nhớ quê hương và muốn bắt chuyến xe về thăm gia đình mình.", "sent_en": "Sometimes I miss my hometown and want to catch a bus to visit my family."},
        (5, "Tôi e là không"): {"sent_vi": "Tôi e là không thể hoàn thành việc sửa xe này trước khi trời tối đâu nhé.", "sent_en": "I'm afraid I cannot finish repairing this car before dark."},
        (5, "(Ý anh) là sao?"): {"sent_vi": "Ý anh là sao khi nói rằng chúng ta nên hoãn chuyến du lịch cuối tuần này?", "sent_en": "What do you mean by saying we should postpone our trip this weekend?"},
        (5, "Phức tạp"): {"sent_vi": "Cách sử dụng phần mềm mới này khá phức tạp đối với những người lớn tuổi rồi.", "sent_en": "How to use this new software is quite complicated for elderly people."},
        (5, "Mỗi 5 năm"): {"sent_vi": "Mỗi năm năm một lần, trường cũ của tôi lại tổ chức ngày hội ngộ cựu học sinh.", "sent_en": "Once every five years, my old school organizes an alumni reunion day."},
        (5, "Thông thường"): {"sent_vi": "Thông thường tôi sẽ đi ngủ sớm để giữ sức khỏe tốt cho ngày làm việc sau.", "sent_en": "Usually I will go to bed early to keep good health for the next working day."},
        (5, "Vấn đề thiếu hụt nhân lực"): {"sent_vi": "Vấn đề thiếu hụt nhân lực làm dự án bị chậm tiến độ so với kế hoạch.", "sent_en": "The staff shortage problem makes the project delayed compared to the plan."},
        # Session 6
        (6, "Tốt hơn là cậu nên…"): {"sent_vi": "Tốt hơn là cậu nên tắt máy tính và đi ngủ sớm đi nghe chưa.", "sent_en": "You had better turn off the computer and go to bed early."},
        (6, "Chuỗi cung ứng"): {"sent_vi": "Sự tắc nghẽn giao thông làm ảnh hưởng chuỗi cung ứng hàng hóa này rồi.", "sent_en": "The traffic congestion has affected this goods supply chain already."},
        (6, "Thiếu hụt"): {"sent_vi": "Tình trạng thiếu hụt năng lượng đang xảy ra ở nhiều nước châu Âu này.", "sent_en": "The energy shortage situation is happening in many European countries."},
        (6, "Đại dịch"): {"sent_vi": "Mọi người phải đeo khẩu trang khi đi xe buýt trong thời kỳ đại dịch.", "sent_en": "People had to wear masks when riding the bus during the pandemic."},
        (6, "Chính phủ Trung Quốc"): {"sent_vi": "Chính phủ Trung Quốc đã đầu tư nhiều tiền vào nghiên cứu vũ trụ mới.", "sent_en": "The Chinese government has invested a lot of money in new space research."},
        (6, "đóng cửa"): {"sent_vi": "Khu vui chơi trẻ em đóng cửa để sửa chữa các thiết bị hỏng này.", "sent_en": "The children's playground is closed to repair these broken devices."},
        (6, "Nỗi đau thật sự"): {"sent_vi": "Việc mất dữ liệu khách hàng chính là nỗi đau thật sự của sếp tôi.", "sent_en": "Losing customer database is the real pain point of my boss."},
        # Session 7
        (7, "Trào ngược dạ dày"): {"sent_vi": "Để hạn chế tình trạng trào ngược dạ dày, bệnh nhân nên xây dựng thói quen nhai kỹ khi ăn uống.", "sent_en": "To limit acid reflux, patients should build a habit of chewing carefully when eating."},
        (7, "Ợ nóng"): {"sent_vi": "Hiện tượng ợ nóng kéo dài thường là tín hiệu cảnh báo về những rối loạn chức năng của cơ thể.", "sent_en": "Prolonged heartburn is often a warning signal of dysfunction of the body."},
        (7, "Đường huyết"): {"sent_vi": "Việc tự đo lường chỉ số đường huyết giúp người bệnh kịp thời phát hiện những dấu hiệu bất thường khác.", "sent_en": "Self-measuring blood sugar index helps patients detect other abnormal signs in time."},
        (7, "Ngộ độc thực phẩm"): {"sent_vi": "Sự bùng phát các vụ ngộ độc thực phẩm đặt ra yêu cầu cấp thiết về giám sát các cơ sở.", "sent_en": "The outbreak of food poisoning incidents poses an urgent demand on supervising establishments."},
        (7, "Ngấn mỡ bụng"): {"sent_vi": "Tập luyện đều đặn là giải pháp tối ưu giúp loại bỏ ngấn mỡ bụng và cải thiện chỉ số này.", "sent_en": "Regular exercise is the optimal solution to help remove love handles and improve this index."},
        (7, "\"Có tâm\""): {"sent_vi": "Một người quản lý thực sự có tâm sẽ luôn nỗ lực tạo dựng môi trường làm việc lành mạnh này.", "sent_en": "A truly dedicated manager will always strive to build this healthy working environment."},
        (7, "Còn khuya mới..."): {"sent_vi": "Dự án nghiên cứu khoa học này còn khuya mới hoàn thành nếu thiếu sự hợp tác các thành viên này.", "sent_en": "This scientific research project is nowhere near completed if lacking cooperation of these members."}
    }
    
    # Read the original CSV lines
    rows = []
    with open(csv_path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        for r in reader:
            rows.append(r)
            
    # Modify the rows
    # The header is on row index 1 (the 2nd line)
    # The data starts at row index 2
    for idx, row in enumerate(rows):
        if idx < 2:
            continue  # Skip empty header row and column headers row
            
        # Parse Session and Item numbers
        try:
            s_num = int(row[1].strip())
            i_num = int(row[2].strip())
        except ValueError:
            continue
            
        term_vi = row[5].strip()
        
        if s_num == 1:
            # Fill Session 1 terms and sentences
            s1_data = s1_items[i_num]
            row[5] = s1_data["term_vi"]
            row[6] = s1_data["term_en"]
            row[7] = s1_data["sent_vi"]
            row[8] = s1_data["sent_en"]
        else:
            # Fill other sessions by looking up (s_num, term_vi)
            key = (s_num, term_vi)
            if key in other_items:
                data = other_items[key]
                row[7] = data["sent_vi"]
                row[8] = data["sent_en"]
                
    # Write the modified rows back to the CSV
    with open(csv_path, mode='w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
        
    print(f"Successfully filled Option 2 sentences into: {csv_path}")

if __name__ == '__main__':
    main()
