import os

api_path = r"c:\Users\Sahil1234\Desktop\835_To_Mir_final\Project835\frontend\src\onesmarter_admin\services\api.js"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace BASE_URL
content = content.replace("const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`;", "const BASE_URL = '/admin-panel/api';")

# Prevent 401 reload loops
content = content.replace("if (res.status === 401) {\n    localStorage.removeItem('onesmarter_admin_token');\n    localStorage.removeItem('onesmarter_admin_user');\n    window.location.reload();\n  }", "// Bypass 401 logout reload")

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.js updated cleanly!")
