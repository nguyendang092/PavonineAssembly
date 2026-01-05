#!/bin/bash

# Hàm để cập nhật imports trong một file
update_file_imports() {
    local file=$1
    local dir=$(dirname "$file")
    
    # Xác định độ sâu của folder để tính relative path
    local depth=$(echo "$dir" | grep -o '/' | wc -l)
    local prefix=""
    
    # Tính toán prefix
    if [ $depth -eq 1 ]; then
        prefix="../"
    elif [ $depth -eq 2 ]; then
        prefix="../../"
    fi
    
    # Cập nhật các import từ root
    sed -i "s|from ['\"]\.\/UserContext['\"]|from '${prefix}contexts/UserContext'|g" "$file"
    sed -i "s|from ['\"]\.\/LoadingContext['\"]|from '${prefix}contexts/LoadingContext'|g" "$file"
    sed -i "s|from ['\"]\.\/firebase['\"]|from '${prefix}services/firebase'|g" "$file"
    sed -i "s|from ['\"]\.\/userLog['\"]|from '${prefix}utils/userLog'|g" "$file"
    sed -i "s|from ['\"]\.\/utils['\"]|from '${prefix}utils/utils'|g" "$file"
    sed -i "s|from ['\"]\.\/i18n['\"]|from '${prefix}config/i18n'|g" "$file"
    sed -i "s|from ['\"]\.\/menuConfig['\"]|from '${prefix}config/menuConfig'|g" "$file"
    sed -i "s|from ['\"]\.\/logUserAction['\"]|from '${prefix}utils/userLog'|g" "$file"
    
    # Cập nhật import CSS
    sed -i "s|from ['\"]\.\/navbar\.css['\"]|from '${prefix}layout/navbar.css'|g" "$file"
    sed -i "s|from ['\"]\.\/App\.css['\"]|from '${prefix}styles/App.css'|g" "$file"
    sed -i "s|from ['\"]\.\/index\.css['\"]|from '${prefix}styles/index.css'|g" "$file"
    sed -i "s|from ['\"]\.\/styles\.css['\"]|from '${prefix}styles/styles.css'|g" "$file"
}

# Cập nhật tất cả các component files
for file in $(find . -name "*.jsx" -type f); do
    echo "Updating $file"
    update_file_imports "$file"
done

echo "✅ Cập nhật tất cả imports hoàn tất"
