import os

app_path = r"c:\Users\Sahil1234\Desktop\835_To_Mir_final\Project835\frontend\src\onesmarter_admin\App.jsx"
with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make isAuthenticated default to true
target_auth = """const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('onesmarter_admin_token'));
  });"""

replacement_auth = """const [isAuthenticated, setIsAuthenticated] = useState(true);"""

content = content.replace(target_auth, replacement_auth)

# Make currentUser default to Sahil Asarkar
target_user = """const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('onesmarter_admin_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });"""

replacement_user = """const [currentUser, setCurrentUser] = useState(() => {
    return { name: "Sahil Asarkar", email: "admin@onesmarter.com", role: "Super Admin", client: "ABC Health Client" };
  });"""

content = content.replace(target_user, replacement_user)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.jsx patched successfully!")
