import React from 'react';
import clsx from 'clsx';
import { useHashRoute } from '../hooks/useHashRoute';
import { useUser } from './UserContext';

type MenuItem = {
  icon: string;
  label: string;
  path: string;
};

export function Navigation() {
  const { currentUser } = useUser();
  const route = useHashRoute();

  const menuItems = React.useMemo<MenuItem[]>(() => {
    switch (currentUser?.role) {
      case 'designer':
        return [
          { icon: '📋', label: '내 요청 목록', path: '' },
          { icon: '➕', label: '새 요청 생성', path: 'create-request' },
        ];
      case 'writer':
        return [{ icon: '📋', label: '작업 목록', path: '' }];
      case 'admin':
        return [
          { icon: '📊', label: '전체 현황', path: '' },
          { icon: '🔧', label: '시스템 도구', path: 'system-tools' },
        ];
      default:
        return [];
    }
  }, [currentUser]);

  if (menuItems.length === 0) {
    return null;
  }

  return (
    <nav className="space-y-1 p-4">
      {menuItems.map((item) => {
        const normalizedRoute = route ?? '';
        const isActive =
          normalizedRoute === item.path ||
          (!!item.path && normalizedRoute.startsWith(`${item.path}/`)) ||
          (!item.path && normalizedRoute === '');

        return (
          <a
            key={item.path || 'root'}
            href={item.path ? `#${item.path}` : '#'}
            className={clsx(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
