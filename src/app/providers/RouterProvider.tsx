import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppRouteId, APP_ROUTES } from '../routes/routes';

interface RouterContextValue {
  currentRoute: AppRouteId;
  navigate: (route: AppRouteId) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function parseHashToRoute(hash: string): AppRouteId {
  const cleanHash = hash.replace(/^#\/?/, '').trim();
  const validRoute = APP_ROUTES.find((r) => r.id === cleanHash);
  return validRoute ? validRoute.id : 'dashboard';
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRouteId>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return parseHashToRoute(window.location.hash);
    }
    return 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseHashToRoute(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (route: AppRouteId) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${route}`;
    }
  };

  return (
    <RouterContext.Provider value={{ currentRoute, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextValue => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
