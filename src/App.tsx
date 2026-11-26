import React from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { PenTool } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { PresetDocPage } from './pages/PresetDocPage';
import { PRESET_DOCUMENTS } from './config/documents';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <header className="app-header">
        <div className="header-inner">
          <NavLink to="/" className="brand">
            <span className="brand-icon">
              <PenTool size={18} />
            </span>
            <span>SignFlow</span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Upload &amp; Sign
            </NavLink>
            {PRESET_DOCUMENTS[0] && (
              <NavLink
                to={`/doc/${PRESET_DOCUMENTS[0].slug}`}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Sample Doc
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/doc/:slug" element={<PresetDocPage />} />
        <Route path="/:slug" element={<PresetDocPage />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
