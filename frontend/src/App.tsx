import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import GetStarted from './pages/get-started/GetStarted';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import RepositoryScan from './pages/repository-scan/RepositoryScan';
import Findings from './pages/findings/Findings';
import Reports from './pages/reports/Reports';
import AIAnalysisHistory from './pages/ai-analysis-history/AIAnalysisHistory';
import Settings from './pages/settings/Settings';
import About from './pages/about/About';
import ScanHistory from './pages/scan-history/ScanHistory';
import { SecurityProvider } from './context/SecurityContext';

function App() {
  return (
    <SecurityProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing / Get Started & Auth routes */}
          <Route path="/" element={<GetStarted />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/login" element={<Login initialTab="login" />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Main App Layout */}
          <Route element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="repositories" element={<RepositoryScan />} />
            <Route path="repository-scan" element={<RepositoryScan />} />
            <Route path="findings" element={<Findings />} />
            <Route path="scan-history" element={<ScanHistory />} />
            <Route path="scan-history/:scanId" element={<ScanHistory />} />
            <Route path="reports" element={<Reports />} />
            <Route path="ai-analysis-history" element={<AIAnalysisHistory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="about" element={<About />} />
            
            {/* Fallback to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SecurityProvider>
  );
}

export default App;
