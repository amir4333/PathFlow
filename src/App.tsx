import React from 'react';
import { RouterProvider } from './app/providers/RouterProvider';
import { ApplicationProvider } from './app/providers/ApplicationProvider';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <ApplicationProvider>
      <RouterProvider>
        <AppShell />
      </RouterProvider>
    </ApplicationProvider>
  );
}
