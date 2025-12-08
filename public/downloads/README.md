# Thư mục Downloads

## Hướng dẫn thêm file tải xuống

1. Đặt file của bạn vào thư mục này (`public/downloads/`)
2. Cập nhật danh sách file trong `src/Downloads.jsx`

## Ví dụ:

Nếu bạn có file: `form-kiem-ke.xlsx`

1. Copy file vào: `public/downloads/form-kiem-ke.xlsx`

2. Thêm vào array `files` trong `Downloads.jsx`:

```javascript
{
  id: 1,
  name: "Form thông báo kiểm kê",
  description: "Form mẫu dùng để thông báo kiểm kê hàng hóa hàng tháng",
  size: "13 KB",
  type: "Excel",
  icon: "📊",
  url: "/downloads/form-kiem-ke.xlsx"
}
```

## Danh sách file cần thêm:

- [ ] form-kiem-ke.xlsx
- [ ] bieu-mau-cham-cong.xlsx
- [ ] quy-trinh-san-xuat.pdf
- [ ] bao-cao-mau.docx

## Lưu ý:

- URL phải bắt đầu bằng `/downloads/`
- Tên file trong URL phải khớp với tên file thực tế
- Có thể đặt file trong subfolder: `/downloads/folder/file.xlsx`
