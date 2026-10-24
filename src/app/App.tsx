import { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { RouterProvider, useRouter } from './router';
import { HomePage } from '../pages/HomePage';
import { QuizPage } from '../pages/QuizPage';
import { ResultPage } from '../pages/ResultPage';
import { DailyPage } from '../pages/DailyPage';
import { BadgesPage } from '../pages/BadgesPage';
import { ProfilePage } from '../pages/ProfilePage';
import { CardPage } from '../pages/CardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TiersPage } from '../pages/TiersPage';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { ToastLayer, useToasts } from '../components/Toasts';
import { NoticeBar } from '../components/NoticeBar';
import { OnboardingModal } from '../components/OnboardingModal';

/** 提供全局存档 + toast；页面级只负责渲染 */
export function App() {
  return (
    <RouterProvider>
      <AppShell />
    </RouterProvider>
  );
}

function AppShell() {
  const store = useGameStore();
  const { route, navigate } = useRouter();
  const toasts = useToasts();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 首次进入（没有存档）时展示一句话说明，但不阻塞
  useEffect(() => {
    const key = 'isr:onboarded:v1';
    try {
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true);
        localStorage.setItem(key, '1');
      }
    } catch {
      /* 忽略 */
    }
  }, []);

  // 主题：减少动画偏好写入 data 属性，CSS 统一响应
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = store.save.reduceMotion ? 'true' : 'false';
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.documentElement.dataset.systemReduceMotion = mq.matches ? 'true' : 'false';
  }, [store.save.reduceMotion]);

  // 路由守卫：未完成首测时，除了 home/quiz/settings/tiers 之外都引导去首测
  useEffect(() => {
    const needsPlacement = !store.save.placed;
    const blocked: string[] = ['result', 'daily', 'badges', 'profile', 'card'];
    if (needsPlacement && blocked.includes(route)) {
      if (route === 'daily') navigate('quiz');
    }
  }, [route, store.save.placed, navigate]);

  const page = (() => {
    switch (route) {
      case 'quiz':
        return <QuizPage store={store} notify={toasts.push} />;
      case 'result':
        return <ResultPage store={store} notify={toasts.push} />;
      case 'daily':
        return <DailyPage store={store} notify={toasts.push} />;
      case 'badges':
        return <BadgesPage store={store} />;
      case 'profile':
        return <ProfilePage store={store} notify={toasts.push} />;
      case 'card':
        return <CardPage store={store} notify={toasts.push} />;
      case 'settings':
        return <SettingsPage store={store} notify={toasts.push} />;
      case 'tiers':
        return <TiersPage store={store} />;
      case 'home':
      default:
        return <HomePage store={store} />;
    }
  })();

  return (
    <div className="app-shell">
      <div className="crt-overlay" aria-hidden="true" />
      <SiteHeader store={store} />
      <NoticeBar notice={store.notice} onDismiss={store.dismissNotice} />
      <main className="app-main" id="main">
        {page}
      </main>
      <SiteFooter />
      <ToastLayer toasts={toasts.list} onDismiss={toasts.dismiss} />
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} navigate={navigate} />}
    </div>
  );
}
