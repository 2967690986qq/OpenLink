import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import DifyPage from './pages/DifyPage';
import ChannelsPage from './pages/ChannelsPage';
import SettingsPage from './pages/SettingsPage';
import DetectPage from './pages/DetectPage';

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo">OpenLink Gateway</div>
          <ul className="sidebar-nav">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                Dify 实例
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/detect"
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                服务检测
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/channels"
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                频道管理
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                设置
              </NavLink>
            </li>
          </ul>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DifyPage />} />
            <Route path="/detect" element={<DetectPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
