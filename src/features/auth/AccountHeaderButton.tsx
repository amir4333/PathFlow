/**
 * Header Account Status & Action Button
 *
 * Displays active student identity or quick sign-in trigger.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSync } from '../../sync/context/SyncContext';
import { useRouter } from '../../app/providers/RouterProvider';
import { User, LogIn, LogOut, Settings, ShieldCheck } from 'lucide-react';

export const AccountHeaderButton: React.FC = () => {
  const { session, isAuthenticated, signOut, openAuthModal } = useSync();
  const { navigate } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!isAuthenticated) {
    return (
      <button
        id="btn-header-signin"
        type="button"
        onClick={openAuthModal}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-2xs cursor-pointer"
        title="Sign In to synchronize with other devices"
      >
        <LogIn className="w-3.5 h-3.5 text-neutral-500" />
        <span>Sign In</span>
      </button>
    );
  }

  const initial = session?.user.email ? session.user.email[0].toUpperCase() : 'S';

  return (
    <div ref={menuRef} className="relative">
      <button
        id="btn-header-account-menu"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-2xs cursor-pointer text-left"
        title={`Signed in as ${session?.user.email}`}
      >
        <div className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[10px]">
          {initial}
        </div>
        <span className="hidden md:inline text-[11px] font-medium text-neutral-700 dark:text-neutral-300 max-w-[110px] truncate">
          {session?.user.email}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold">
              Signed In As
            </div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate mt-0.5">
              {session?.user.email}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 capitalize font-medium">
              <ShieldCheck className="w-3 h-3" />
              <span>{session?.user.role} Account</span>
            </div>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('settings');
              }}
              className="w-full px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-2 cursor-pointer transition"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
              <span>Account & Sync Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="w-full px-3 py-2 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-2 cursor-pointer transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
