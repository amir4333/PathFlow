import React from 'react';
import { RouterProvider } from './app/providers/RouterProvider';
import { ApplicationProvider } from './app/providers/ApplicationProvider';
import { UserPreferencesProvider } from './app/preferences/UserPreferencesContext';
import { ActiveSessionProvider } from './features/sessions/ActiveSessionContext';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <ApplicationProvider>
      <UserPreferencesProvider>
        <ActiveSessionProvider>
          <RouterProvider>
            <AppShell />
          </RouterProvider>
        </ActiveSessionProvider>
      </UserPreferencesProvider>
    </ApplicationProvider>
  );
}
