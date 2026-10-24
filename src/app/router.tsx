import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type RouteName = 'home' | 'quiz' | 'result' | 'daily' | 'badges' | 'profile' | 'card' | 'settings' | 'tiers';

const ROUTES: RouteName[] = ['home', 'quiz', 'result', 'daily', 'badges', 'profile', 'card', 'settings', 'tiers'];

function parseHash(): RouteName {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const found = ROUTES.find((r) => r === raw);
  return found ?? 'home';
}

interface RouterValue {
  route: RouteName;
  navigate: (route: RouteName) => void;
}

const RouterContext = createContext<RouterValue>({ route: 'home', navigate: () => undefined });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<RouteName>(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (next: RouteName) => {
    if (parseHash() === next) {
      // hash 相同也要回到顶部，避免用户以为没反应
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.location.hash = `#/${next}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}
