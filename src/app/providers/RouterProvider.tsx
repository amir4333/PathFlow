import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppRouteId, APP_ROUTES } from '../routes/routes';

export interface RouteState {
  route: AppRouteId;
  params: Record<string, string>;
  hashString: string;
}

interface RouterContextValue {
  currentRoute: AppRouteId;
  params: Record<string, string>;
  hashString: string;
  navigate: (pathOrRoute: string | AppRouteId, params?: Record<string, string>) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

export function parseHashToState(hash: string): RouteState {
  const cleanHash = hash.replace(/^#\/?/, '').trim();
  if (!cleanHash) {
    return { route: 'dashboard', params: {}, hashString: 'dashboard' };
  }

  // Handle patterns:
  // goals/:id
  // roadmaps/:id
  // or query/hash strings
  const parts = cleanHash.split('/');
  let baseSegment = parts[0] as AppRouteId;
  if (baseSegment === 'teacher') {
    baseSegment = 'teacher-view';
  }
  const validRoute = APP_ROUTES.find((r) => r.id === baseSegment);

  if (!validRoute) {
    return { route: 'dashboard', params: {}, hashString: 'dashboard' };
  }

  const params: Record<string, string> = {};
  if (baseSegment === 'teacher-view') {
    if (parts[1] === 'goal' && parts[2]) {
      params.subview = 'goal';
      params.goalId = parts[2];
      params.id = parts[2];
    } else if (parts[1] === 'roadmap' && parts[2]) {
      params.subview = 'roadmap';
      params.roadmapId = parts[2];
      params.id = parts[2];
    } else if (parts[1]) {
      params.id = parts[1];
    }
  } else if (parts.length > 1 && parts[1]) {
    params.id = parts[1];
  }

  return {
    route: validRoute.id,
    params,
    hashString: cleanHash,
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [routeState, setRouteState] = useState<RouteState>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return parseHashToState(window.location.hash);
    }
    return { route: 'dashboard', params: {}, hashString: 'dashboard' };
  });

  useEffect(() => {
    const handleHashChange = () => {
      setRouteState(parseHashToState(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (pathOrRoute: string | AppRouteId, params?: Record<string, string>) => {
    let targetHash = pathOrRoute;
    if (params && params.id) {
      targetHash = `${pathOrRoute}/${params.id}`;
    }
    const newState = parseHashToState(targetHash);
    setRouteState(newState);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${targetHash}`;
    }
  };

  return (
    <RouterContext.Provider
      value={{
        currentRoute: routeState.route,
        params: routeState.params,
        hashString: routeState.hashString,
        navigate,
      }}
    >
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
