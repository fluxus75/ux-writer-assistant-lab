import React from 'react';

export function useHashRoute() {
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
