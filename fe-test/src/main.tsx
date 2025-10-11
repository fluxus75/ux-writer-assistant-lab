import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoleSelector } from './components/RoleSelector';
import { UserProvider, useUser } from './components/UserContext';
import { DesignerDashboard } from './pages/DesignerDashboard';
import { WriterDashboard } from './pages/WriterDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { RequestDetail } from './pages/RequestDetail';
import { RequestCreate } from './pages/RequestCreate';

function useHashRoute() {
  const [route, setRoute] = React.useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''),
  );

  React.useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.replace(/^#/, ''));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return route;
}

function RouterView() {
  const { currentUser } = useUser();
  const route = useHashRoute();

  if (!currentUser) {
    return <RoleSelector />;
  }

  const [segment, requestId] = route.split('/');

  if (segment === 'request' && requestId) {
    return <RequestDetail requestId={requestId} mode="view" onBack={() => (window.location.hash = '')} />;
  }

  if (segment === 'work' && requestId) {
    return <RequestDetail requestId={requestId} mode="work" onBack={() => (window.location.hash = '')} />;
  }

  if (segment === 'create-request') {
    return <RequestCreate />;
  }

  switch (currentUser.role) {
    case 'designer':
      return <DesignerDashboard />;
    case 'writer':
      return <WriterDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <RoleSelector />;
  }
}

function App() {
  return (
    <UserProvider>
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <RouterView />
      </div>
    </UserProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
