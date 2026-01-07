# Hướng Dẫn Cài Đặt Google Maps API

## Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập bằng tài khoản Google
3. Click "Select a project" → "New Project"
4. Nhập tên project (VD: "Driver Logbook")
5. Click "Create"

## Bước 2: Enable APIs

1. Trong Google Cloud Console, vào **APIs & Services** → **Library**
2. Tìm và enable các API sau:
   - **Distance Matrix API** (bắt buộc - để tính khoảng cách)
   - **Places API** (tùy chọn - để autocomplete địa chỉ)
   - **Directions API** (tùy chọn - để hiển thị route)

## Bước 3: Tạo API Key

1. Vào **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy API key vừa tạo
4. **QUAN TRỌNG:** Click vào API key để cấu hình restrictions

## Bước 4: Bảo Mật API Key

### Application Restrictions (Khuyến nghị: HTTP referrers)

```
http://localhost:*
https://yourdomain.com/*
```

### API Restrictions (Chọn APIs được phép)

- Distance Matrix API
- Places API (nếu dùng)
- Directions API (nếu dùng)

## Bước 5: Thêm API Key Vào Project

### Cách 1: Environment Variables (Khuyến nghị)

Tạo file `.env.local` trong thư mục root:

```
VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

Cập nhật trong DriverLogbook.jsx:

```javascript
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### Cách 2: Direct (Chỉ dùng cho test)

Thay thế trong file `DriverLogbook.jsx` dòng:

```javascript
const apiKey = "AIzaSyBqVHl5TXKnQ-EXAMPLE-KEY";
```

thành:

```javascript
const apiKey = "YOUR_ACTUAL_API_KEY";
```

## Bước 6: Giải Quyết CORS Issue

Google Maps Distance Matrix API có thể gặp lỗi CORS khi gọi từ frontend. Có 2 giải pháp:

### Giải Pháp 1: Sử dụng Backend Proxy (Khuyến nghị cho production)

Tạo endpoint trên backend để gọi Google Maps API:

```javascript
// backend/api/distance.js (Node.js example)
const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/calculate", async (req, res) => {
  const { origin, destination } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json`,
      {
        params: {
          origins: origin,
          destinations: destination,
          mode: "driving",
          key: apiKey,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate distance" });
  }
});

module.exports = router;
```

### Giải Pháp 2: Sử dụng Google Maps JavaScript Library

Thêm script trong `index.html`:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
```

Cập nhật calculateDistance function:

```javascript
const calculateDistance = () => {
  if (!window.google) {
    setAlert({
      show: true,
      type: "error",
      message: "❌ Google Maps chưa được load",
    });
    return;
  }

  const service = new window.google.maps.DistanceMatrixService();
  service.getDistanceMatrix(
    {
      origins: [newTrip.departure],
      destinations: [newTrip.destination],
      travelMode: "DRIVING",
    },
    (response, status) => {
      if (status === "OK") {
        const result = response.rows[0].elements[0];
        if (result.status === "OK") {
          const distanceInKm = (result.distance.value / 1000).toFixed(1);
          setEstimatedKm(distanceInKm);
          setAlert({
            show: true,
            type: "success",
            message: `✅ Ước tính khoảng cách: ${distanceInKm} km`,
          });
        }
      } else {
        setAlert({
          show: true,
          type: "error",
          message: "❌ Không thể tính khoảng cách",
        });
      }
    }
  );
};
```

## Bước 7: Chi Phí & Quota

### Giá (tính đến 2024)

- Distance Matrix API: $5 per 1,000 requests
- **Miễn phí:** $200 credit mỗi tháng (~40,000 requests)

### Giới Hạn

- Tối đa 100 elements per request
- Tối đa 100 elements per second

### Monitor Usage

1. Vào Google Cloud Console
2. **APIs & Services** → **Dashboard**
3. Xem charts để theo dõi usage

## Lưu Ý Quan Trọng

⚠️ **BẢO MẬT API KEY**

- KHÔNG commit API key lên Git
- Thêm `.env.local` vào `.gitignore`
- Sử dụng environment variables
- Set up API restrictions

⚠️ **CORS**

- Frontend trực tiếp gọi API có thể gặp CORS
- Khuyến nghị dùng backend proxy cho production

⚠️ **CHI PHÍ**

- Monitor usage thường xuyên
- Set up billing alerts
- Implement caching để giảm số request

## Testing

Test API key bằng URL (thay YOUR_API_KEY):

```
https://maps.googleapis.com/maps/api/distancematrix/json?origins=Hanoi,Vietnam&destinations=Ho%20Chi%20Minh,Vietnam&key=YOUR_API_KEY
```

Nếu thành công, bạn sẽ thấy JSON response với khoảng cách.
