import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminHome, Join } from './pages/Admin';
import { Brand } from './pages/Brand';
import { MarketingLanding } from './pages/Marketing';
import { Landing, QuickCheck, Resume, Setup, SignIn, SignUp } from './pages/Public';
import { Report } from './pages/Review';
import { StaffHome } from './pages/Staff';
import { AppHome, StaffCase } from './pages/Workspace';
import { SessionProvider, useSession } from './session';
import './styles.css';
import { PageLoader } from './ui';

function App() {
  const { ready } = useSession();
  if (!ready) return <PageLoader />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sell" element={<MarketingLanding />} />
      <Route path="/resume/:id" element={<Resume />} />
      <Route path="/check/:kind" element={<QuickCheck />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/app" element={<AppHome />} />
      <Route path="/staff" element={<StaffHome />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/case/:id" element={<StaffCase />} />
      <Route path="/report/:id" element={<Report />} />
      <Route path="/brand" element={<Brand />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
