import os

app_path = r"c:\Users\Sahil1234\Desktop\835_To_Mir_final\Project835\frontend\src\onesmarter_admin\App.jsx"
with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add isSidebarOpen state
target_state = """const [currentUser, setCurrentUser] = useState(() => {"""
replacement_state = """const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {"""

content = content.replace(target_state, replacement_state)

# Pass onToggleSidebar to Header
target_header = """      <Header
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />"""

replacement_header = """      <Header
        onSignOut={handleSignOut}
        currentUser={currentUser}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />"""

content = content.replace(target_header, replacement_header)

# Make rail toggleable with display style
target_rail = """        <nav className="rail">"""
replacement_rail = """        <nav className="rail" style={{ display: isSidebarOpen ? 'block' : 'none' }}>"""

content = content.replace(target_rail, replacement_rail)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.jsx sidebar toggle added successfully!")
