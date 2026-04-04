import AllEmployeesManager from "./AllEmployeesManager";

/**
 * Danh sách chỉ nhân viên trạng thái nghỉ việc — dữ liệu vẫn là employeeProfiles.
 */
export default function ResignedEmployeesManager() {
  return <AllEmployeesManager resignedOnly />;
}
