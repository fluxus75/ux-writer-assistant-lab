import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell';
import { RoleSelector } from './components/RoleSelector';
import { UserProvider, useUser } from './components/UserContext';
import { useHashRoute } from './hooks/useHashRoute';
import { AdminDashboard } from './pages/AdminDashboard';
import { DesignerDashboard } from './pages/DesignerDashboard';
import { DownloadPage } from './pages/DownloadPage';
import { RequestCreate } from './pages/RequestCreate';
import { RequestBatchCreate } from './pages/RequestBatchCreate';
import { RequestDetail } from './pages/RequestDetail';
import { WriterDashboard } from './pages/WriterDashboard';

function RouterView() {
  const { currentUser } = useUser();
  const route = useHashRoute();

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <RoleSelector />
      </div>
    );
  }

  const [segment, requestId] = route.split('/');

  let view: React.ReactNode;
  if (segment === 'request' && requestId === 'batch') {
    view = <RequestBatchCreate />;
  } else if (segment === 'request' && requestId) {
    view = <RequestDetail requestId={requestId} mode="view" onBack={() => (window.location.hash = '')} />;
  } else if (segment === 'work' && requestId) {
    view = <RequestDetail requestId={requestId} mode="work" onBack={() => (window.location.hash = '')} />;
  } else if (segment === 'create-request') {
    view = <RequestCreate />;
  } else if (segment === 'download') {
    view = <DownloadPage />;
  } else if (segment === 'system-tools') {
    view = <AdminDashboard initialSection="system" />;
  } else {
    switch (currentUser.role) {
      case 'designer':
        view = <DesignerDashboard />;
        break;
      case 'writer':
        view = <WriterDashboard />;
        break;
      case 'admin':
        view = <AdminDashboard />;
        break;
      default:
        view = <RoleSelector />;
        break;
    }
  }

  return <AppShell>{view}</AppShell>;
}

function App() {
  return (
    <UserProvider>
      <RouterView />
    </UserProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
