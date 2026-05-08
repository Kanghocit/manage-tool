# Chính sách Bảo mật – Hỗ trợ Zalo (Zalo Assistant)

**Cập nhật lần cuối:** 08/05/2026  
**Áp dụng cho:** Tiện ích mở rộng Chrome "Hỗ trợ Zalo" (`Zalo Assistant`) phiên bản 0.1.x trở lên.  
**Đơn vị phát hành:** ankhang.name.vn  
**Liên hệ:** ankhangit06@gmail.com

---

## 1. Tổng quan

Chính sách này mô tả cách tiện ích mở rộng "Hỗ trợ Zalo" (sau đây gọi là **"Tiện ích"**) thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu của bạn khi bạn cài đặt và sử dụng Tiện ích trên trình duyệt Chrome.

Bằng việc cài đặt và sử dụng Tiện ích, bạn xác nhận đã đọc, hiểu và đồng ý với các điều khoản trong Chính sách này.

---

## 2. Dữ liệu mà Tiện ích thu thập

Tiện ích chỉ thu thập dữ liệu **tối thiểu** cần thiết để hoạt động:

### 2.1. Dữ liệu tài khoản (chỉ khi bạn chủ động đăng nhập)

| Dữ liệu | Nguồn | Cách xử lý |
|---|---|---|
| Địa chỉ email | Bạn nhập tại trang Đăng nhập | Gửi qua HTTPS tới máy chủ `api.ankhang.name.vn` để xác thực; lưu cục bộ trong `chrome.storage.local` (khóa `authEmail`, `authIdentity`) để hiển thị trong giao diện |
| Mật khẩu | Bạn nhập tại trang Đăng nhập | **Chỉ** gửi 1 lần qua HTTPS tới `/api/auth/login` để xác thực; **không** lưu trong Tiện ích sau khi gửi |
| Access Token | Máy chủ trả về sau khi đăng nhập thành công | Lưu cục bộ trong `chrome.storage.local` (khóa `authToken`) để duy trì phiên đăng nhập; gửi kèm theo các yêu cầu API tiếp theo |

### 2.2. Dữ liệu license

| Dữ liệu | Nguồn | Cách xử lý |
|---|---|---|
| License Key | Bạn nhập tại trang License | Gửi tới `/api/license/activate`, `/api/license/verify`; lưu cục bộ trong `chrome.storage.local` (khóa `settings.licenseKey`) |
| Device ID | Sinh ngẫu nhiên (UUID v4) tại máy của bạn lần đầu mở Tiện ích | Lưu cục bộ trong `chrome.storage.local` (khóa `deviceId`); gửi tới máy chủ để gắn license với thiết bị. Đây là chuỗi ngẫu nhiên, **không** chứa thông tin định danh phần cứng/người dùng |

### 2.3. Dữ liệu vận hành do bạn cung cấp

| Dữ liệu | Nguồn | Cách xử lý |
|---|---|---|
| Danh sách số điện thoại | File Excel/CSV bạn tự tải lên Tiện ích | **Chỉ xử lý trong trình duyệt của bạn**, **không** gửi tới máy chủ của chúng tôi. Chỉ truyền tới `chat.zalo.me` thông qua thao tác mô phỏng người dùng |
| Mẫu tin nhắn, ảnh đính kèm | Bạn nhập/chọn trong giao diện Tiện ích | **Không** gửi tới máy chủ của chúng tôi. Chỉ truyền tới `chat.zalo.me` |
| Lịch sử thao tác (số đã quét, đã gửi, đã kết bạn) | Tự sinh ra khi bạn chạy tác vụ | Lưu cục bộ trong `chrome.storage.local`; bạn có thể xóa bất cứ lúc nào trong trang **Lịch sử** |
| Thống kê (số lượng kết bạn/tin nhắn) | Tự sinh ra khi bạn chạy tác vụ | Lưu cục bộ trong `chrome.storage.local` (khóa `stats`) |
| Cài đặt cá nhân | Bạn cấu hình trong trang Cài đặt | Lưu cục bộ trong `chrome.storage.local` (khóa `settings`) |

### 2.4. Dữ liệu mà Tiện ích **KHÔNG** thu thập

- ❌ **Không** đọc nội dung trò chuyện riêng tư của bạn trên Zalo.
- ❌ **Không** đọc danh bạ Zalo của bạn trừ khi bạn chủ động cung cấp file.
- ❌ **Không** thu thập thông tin duyệt web ngoài phạm vi `chat.zalo.me` và giao diện chính của Tiện ích.
- ❌ **Không** dùng cookie tracking, analytics, ads, fingerprinting hay bất kỳ SDK bên thứ ba nào.
- ❌ **Không** thu thập vị trí, danh bạ thiết bị, lịch sử vị trí, ảnh ngoài phạm vi bạn chủ động chọn.
- ❌ **Không** ghi/đọc clipboard tự động.

---

## 3. Mục đích sử dụng dữ liệu

Chúng tôi chỉ sử dụng dữ liệu cho các mục đích sau:

1. **Xác thực tài khoản:** kiểm tra email/mật khẩu để cấp Access Token cho phiên đăng nhập.
2. **Quản lý license:** kích hoạt và xác minh license trên thiết bị của bạn.
3. **Vận hành tác vụ tự động:** thực hiện các thao tác bạn yêu cầu trên `chat.zalo.me` (quét số, kết bạn, nhắn tin hàng loạt) bằng cách mô phỏng tương tác người dùng.
4. **Lưu lịch sử & cài đặt:** giúp bạn xem lại kết quả và khôi phục cấu hình giữa các phiên làm việc.

Chúng tôi **KHÔNG** dùng dữ liệu của bạn cho:

- Quảng cáo, retargeting, profiling.
- Bán/cho thuê cho bên thứ ba.
- Đào tạo mô hình AI/ML.
- Đánh giá tín dụng hoặc chấm điểm hành vi.

---

## 4. Chia sẻ dữ liệu với bên thứ ba

Tiện ích **không bán, không cho thuê, không chia sẻ** dữ liệu cá nhân của bạn cho bên thứ ba, **NGOẠI TRỪ** các trường hợp sau:

| Bên nhận | Dữ liệu chia sẻ | Mục đích |
|---|---|---|
| `api.ankhang.name.vn` (máy chủ của chính nhà phát triển) | Email, mật khẩu (1 lần), access token, license key, device ID | Xác thực và quản lý license |
| `chat.zalo.me` (Zalo – VNG Corporation) | Các thao tác bạn chủ động thực hiện (gõ số điện thoại, nhập tin nhắn, click) | Tiện ích thay bạn thao tác trên giao diện Zalo Web mà bạn đã đăng nhập |
| Cơ quan pháp luật | Theo yêu cầu hợp pháp | Tuân thủ quy định pháp luật |

Chúng tôi **không** sử dụng Google Analytics, Facebook Pixel, hay bất cứ dịch vụ theo dõi/quảng cáo nào.

---

## 5. Quyền (permissions) mà Tiện ích yêu cầu và lý do

Theo `manifest.json` của Tiện ích:

| Quyền | Lý do sử dụng |
|---|---|
| `storage` | Lưu cài đặt, lịch sử, license key, access token cục bộ trong trình duyệt |
| `tabs` | Mở/cập nhật tab `chat.zalo.me` và các trang nội bộ của Tiện ích |
| `scripting` | Tiêm content script vào `chat.zalo.me` để thực hiện thao tác bạn yêu cầu |
| `downloads` | Cho phép bạn xuất lịch sử/kết quả ra file Excel/CSV |
| `host_permissions: https://chat.zalo.me/*` | Tự động hóa thao tác trên Zalo Web |
| `host_permissions: https://api.ankhang.name.vn/*` | Gọi API xác thực và license |

Tiện ích **không** yêu cầu quyền `<all_urls>`, `webRequest`, `cookies`, `history`, `bookmarks`, hay bất kỳ quyền nhạy cảm nào khác.

---

## 6. Lưu trữ và bảo mật dữ liệu

- **Dữ liệu cục bộ** được lưu trong `chrome.storage.local` của trình duyệt – chỉ truy cập được bởi Tiện ích này trên máy của bạn. Khi bạn gỡ Tiện ích, Chrome sẽ tự động xóa vùng lưu trữ này.
- **Dữ liệu trên máy chủ** (email, hashed password, license key, device ID liên kết) được lưu trên hạ tầng `api.ankhang.name.vn` do nhà phát triển vận hành, có TLS/HTTPS bắt buộc.
- Mật khẩu trên máy chủ được lưu dưới dạng **đã băm (hashed)**, không lưu mật khẩu thuần.
- Mọi giao tiếp giữa Tiện ích và máy chủ đều qua **HTTPS**.

---

## 7. Thời gian lưu trữ

| Dữ liệu | Thời gian lưu |
|---|---|
| Dữ liệu cục bộ (settings, stats, history) | Cho đến khi bạn xóa thủ công hoặc gỡ Tiện ích |
| `authToken` | Đến khi bạn đăng xuất hoặc xóa thủ công |
| Tài khoản & license trên máy chủ | Trong suốt thời gian license còn hiệu lực + 12 tháng để phục vụ hỗ trợ kỹ thuật, sau đó sẽ bị xóa hoặc ẩn danh hóa |

---

## 8. Quyền của người dùng

Bạn có quyền:

1. **Truy cập** dữ liệu cá nhân chúng tôi đang lưu trữ về bạn.
2. **Chỉnh sửa** thông tin tài khoản (email) bằng cách liên hệ hỗ trợ.
3. **Xóa** dữ liệu cục bộ bằng cách gỡ Tiện ích, hoặc xóa dữ liệu trên máy chủ bằng cách gửi email tới `ankhangit06@gmail.com` với tiêu đề "Yêu cầu xóa tài khoản".
4. **Đăng xuất** bất cứ lúc nào trong trang Đăng nhập của Tiện ích – `authToken` sẽ bị xóa khỏi máy của bạn.
5. **Khiếu nại** với cơ quan bảo vệ dữ liệu nếu cho rằng quyền của bạn bị vi phạm.

Chúng tôi sẽ phản hồi yêu cầu hợp lệ trong vòng **30 ngày** làm việc.

---

## 9. Trẻ em

Tiện ích **không hướng đến** người dùng dưới 16 tuổi. Chúng tôi không chủ ý thu thập dữ liệu của trẻ em. Nếu bạn cho rằng trẻ em đã cung cấp dữ liệu cho chúng tôi, vui lòng liên hệ để chúng tôi xóa.

---

## 10. Tuân thủ chính sách Chrome Web Store

Tiện ích cam kết tuân thủ [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/) và [Limited Use Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use/), bao gồm:

- **Single Purpose:** Tiện ích chỉ phục vụ một mục đích duy nhất là **hỗ trợ thao tác hàng loạt trên Zalo Web cho người dùng đã có license**.
- **Minimum Permissions:** Chỉ yêu cầu các quyền tối thiểu cần thiết.
- **Limited Use:** Dữ liệu người dùng chỉ được dùng cho mục đích đã công bố trong Chính sách này.

---

## 11. Thay đổi chính sách

Chúng tôi có thể cập nhật Chính sách này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ:

- Cập nhật ngày ở đầu trang.
- Đăng thông báo trong Tiện ích (nếu thay đổi ảnh hưởng tới quyền riêng tư).

Bạn nên xem lại trang này định kỳ.

---

## 12. Liên hệ

Mọi câu hỏi, yêu cầu hoặc khiếu nại liên quan đến quyền riêng tư, vui lòng gửi tới:

- **Email:** ankhangit06@gmail.com
- **Website:** https://ankhang.name.vn
- **Chính sách bảo mật (URL chuẩn):** https://ankhang.name.vn/privacy

---

*Tài liệu này là phiên bản tiếng Việt. Trong trường hợp có sự sai khác giữa các bản dịch, bản tiếng Việt có giá trị áp dụng.*
