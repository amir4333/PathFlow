import React from 'react';
import { RouterProvider } from './app/providers/RouterProvider';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <RouterProvider>
      <AppShell />
    </RouterProvider>
  );
}
