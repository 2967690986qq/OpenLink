import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useState, useEffect } from 'react';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import ChannelsPage from './pages/ChannelsPage';
import SettingsPage from './pages/SettingsPage';
import {
  Database,
  MessageSquare,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';

// Make toast available globally (to replace alert)
declare global {
  interface Window {
    toast: typeof toast;
  }
}
window.toast = toast;

function App() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('openlink-dark') === 'true';
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('openlink-dark', String(dark));
  }, [dark]);

  return (
    <BrowserRouter>
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Database size={16} color="white" />
            </div>
            OpenLink
          </div>

          <ul className="sidebar-nav">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Database size={18} />
                知识库配置
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/channels"
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <MessageSquare size={18} />
                频道管理
              </NavLink>
            </li>
          </ul>

          <div className="sidebar-footer">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Settings size={18} />
              设置
            </NavLink>
            <button
              onClick={() => setDark(!dark)}
              className="sidebar-nav-item"
              title={dark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? '浅色模式' : '深色模式'}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<KnowledgeBasePage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {/* Toast Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'var(--font-family-sans)',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
