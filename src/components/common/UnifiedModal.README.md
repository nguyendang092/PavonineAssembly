# UnifiedModal Component - Hướng dẫn sử dụng

## Giới thiệu

`UnifiedModal` là component modal đồng nhất về màu sắc và thiết kế cho toàn bộ ứng dụng PavonineAssembly. Component này giúp:

- ✅ Đồng nhất màu sắc theo design system
- ✅ Tái sử dụng code, giảm duplication
- ✅ Dễ dàng maintain và update
- ✅ Responsive và có animation mượt mà

## Props

| Prop              | Type        | Default  | Mô tả                                                      |
| ----------------- | ----------- | -------- | ---------------------------------------------------------- |
| `isOpen`          | `boolean`   | -        | **Bắt buộc**. Hiển thị hoặc ẩn modal                       |
| `onClose`         | `function`  | -        | Callback khi đóng modal (click backdrop hoặc nút X)        |
| `variant`         | `string`    | `'info'` | Loại modal: `'info'`, `'warning'`, `'success'`, `'danger'` |
| `title`           | `string`    | -        | **Bắt buộc**. Tiêu đề modal                                |
| `message`         | `string`    | -        | Nội dung text đơn giản (optional nếu dùng `children`)      |
| `children`        | `ReactNode` | -        | Nội dung tùy chỉnh của modal (table, form, etc.)           |
| `actions`         | `Array`     | `[]`     | Mảng các button actions (xem chi tiết bên dưới)            |
| `size`            | `string`    | `'lg'`   | Kích thước: `'sm'`, `'md'`, `'lg'`, `'xl'`, `'2xl'`        |
| `showCloseButton` | `boolean`   | `true`   | Hiển thị nút X đóng ở góc phải header                      |
| `icon`            | `string`    | -        | Icon tùy chỉnh (VD: '🔔', '📋'). Mặc định theo variant     |

### Actions Array

Mỗi phần tử trong `actions` array có cấu trúc:

```javascript
{
  label: string,        // Text hiển thị trên button
  onClick: function,    // Callback khi click button
  variant: string,      // 'primary' | 'secondary' | 'danger'
  disabled: boolean     // Disable button (optional)
}
```

## Variants và Màu sắc

### 1. Info (Thông tin)

- **Màu sắc**: Indigo → Purple gradient
- **Icon mặc định**: ℹ️
- **Dùng cho**: Thông báo chung, hướng dẫn, hiển thị dữ liệu

```jsx
<UnifiedModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  variant="info"
  title="Thông tin nhân viên"
  message="Đây là thông tin chi tiết về nhân viên."
  actions={[
    { label: "Đóng", onClick: handleClose, variant: "secondary" },
    { label: "Xem chi tiết", onClick: handleView, variant: "primary" },
  ]}
/>
```

### 2. Warning (Cảnh báo)

- **Màu sắc**: Orange → Red gradient
- **Icon mặc định**: ⚠️
- **Dùng cho**: Cảnh báo, thông tin quan trọng cần chú ý

```jsx
<UnifiedModal
  isOpen={showWarning}
  onClose={() => setShowWarning(false)}
  variant="warning"
  title="Nhân viên chưa điểm danh"
  message="Có 10 nhân viên chưa điểm danh hôm nay."
  actions={[
    { label: "Bỏ qua", onClick: handleDismiss, variant: "secondary" },
    { label: "Xem danh sách", onClick: handleView, variant: "primary" },
  ]}
/>
```

### 3. Success (Thành công)

- **Màu sắc**: Green → Emerald gradient
- **Icon mặc định**: ✅
- **Dùng cho**: Xác nhận thao tác thành công

```jsx
<UnifiedModal
  isOpen={showSuccess}
  onClose={() => setShowSuccess(false)}
  variant="success"
  title="Lưu thành công"
  message="Dữ liệu đã được lưu vào hệ thống."
  size="sm"
  actions={[{ label: "Đóng", onClick: handleClose, variant: "primary" }]}
/>
```

### 4. Danger (Nguy hiểm)

- **Màu sắc**: Red → Pink gradient
- **Icon mặc định**: 🚨
- **Dùng cho**: Xác nhận xóa, hành động không thể hoàn tác

```jsx
<UnifiedModal
  isOpen={showDelete}
  onClose={() => setShowDelete(false)}
  variant="danger"
  title="Xác nhận xóa"
  message="Bạn có chắc chắn muốn xóa nhân viên này? Hành động không thể hoàn tác!"
  actions={[
    { label: "Hủy", onClick: handleCancel, variant: "secondary" },
    { label: "Xóa", onClick: handleDelete, variant: "danger" },
  ]}
/>
```

## Ví dụ nâng cao - Custom Content

### Modal với Table

```jsx
<UnifiedModal
  isOpen={showEmployeeList}
  onClose={() => setShowEmployeeList(false)}
  variant="info"
  title="Danh sách nhân viên"
  size="xl"
  actions={[
    { label: "Đóng", onClick: handleClose, variant: "secondary" },
    { label: "Xuất Excel", onClick: handleExport, variant: "primary" },
  ]}
>
  {/* Custom table content */}
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <tr>
          <th className="px-4 py-3 text-left">STT</th>
          <th className="px-4 py-3 text-left">Tên</th>
          <th className="px-4 py-3 text-left">Bộ phận</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp, idx) => (
          <tr key={emp.id}>
            <td className="px-4 py-3">{idx + 1}</td>
            <td className="px-4 py-3">{emp.name}</td>
            <td className="px-4 py-3">{emp.department}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</UnifiedModal>
```

### Modal với Form

```jsx
<UnifiedModal
  isOpen={showForm}
  onClose={() => setShowForm(false)}
  variant="info"
  title="Thêm nhân viên mới"
  size="md"
  actions={[
    { label: "Hủy", onClick: handleCancel, variant: "secondary" },
    {
      label: "Lưu",
      onClick: handleSave,
      variant: "primary",
      disabled: !isFormValid,
    },
  ]}
>
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        Họ và tên
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
      />
    </div>
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        Bộ phận
      </label>
      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
      >
        <option value="">Chọn bộ phận</option>
        <option value="sx">Sản xuất</option>
        <option value="qc">Kiểm tra chất lượng</option>
      </select>
    </div>
  </div>
</UnifiedModal>
```

## Best Practices

### 1. State Management

```jsx
const [showModal, setShowModal] = useState(false);

// Mở modal
const handleOpen = () => setShowModal(true);

// Đóng modal
const handleClose = () => setShowModal(false);
```

### 2. Auto-dismiss cho Success Messages

```jsx
useEffect(() => {
  if (showSuccess) {
    const timer = setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [showSuccess]);
```

### 3. Disabled Actions khi đang xử lý

```jsx
const [isLoading, setIsLoading] = useState(false);

<UnifiedModal
  actions={[
    {
      label: isLoading ? "Đang xử lý..." : "Xác nhận",
      onClick: handleSubmit,
      variant: "primary",
      disabled: isLoading,
    },
  ]}
/>;
```

### 4. Multiple Modals - Đúng z-index

```jsx
// Modal chính: z-[110] (mặc định)
<UnifiedModal isOpen={showMain} ... />

// Modal phụ (mở từ modal chính): tự điều chỉnh z-index nếu cần
// Hoặc đóng modal chính trước khi mở modal phụ
```

## Kích thước phù hợp theo use case

- **sm**: Confirmation dialogs, success messages (max-w-md)
- **md**: Forms nhỏ, quick actions (max-w-2xl)
- **lg**: Tables, lists - **Mặc định** (max-w-4xl)
- **xl**: Detailed reports, large forms (max-w-5xl)
- **2xl**: Full-featured views, dashboards (max-w-7xl)

## Migration từ code cũ

### Trước (custom modal):

```jsx
{
  showPopup && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-lg">
        <h3 className="text-xl font-bold mb-4">Tiêu đề</h3>
        <p>Nội dung...</p>
        <div className="flex gap-2 mt-4">
          <button onClick={handleClose}>Đóng</button>
          <button onClick={handleConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
```

### Sau (UnifiedModal):

```jsx
<UnifiedModal
  isOpen={showPopup}
  onClose={handleClose}
  variant="info"
  title="Tiêu đề"
  message="Nội dung..."
  actions={[
    { label: "Đóng", onClick: handleClose, variant: "secondary" },
    { label: "Xác nhận", onClick: handleConfirm, variant: "primary" },
  ]}
/>
```

## Lợi ích

1. **Consistency**: Màu sắc và design đồng nhất trên toàn bộ app
2. **Maintainability**: Chỉ cần update 1 component, tất cả modals đều thay đổi
3. **Reusability**: Giảm 70-80% code duplication
4. **Accessibility**: Built-in animations, backdrop blur, responsive
5. **Developer Experience**: API đơn giản, dễ sử dụng

## Files liên quan

- Component: `/src/components/common/UnifiedModal.jsx`
- Example: `/src/components/common/UnifiedModal.example.jsx`
- Implementation: `/src/components/attendance/AttendanceList.jsx` (popup nhân viên chưa điểm danh)

---

**Tạo bởi**: PavonineAssembly Team  
**Cập nhật**: March 2026
