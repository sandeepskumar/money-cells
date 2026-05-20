import React from 'react';
import { AppProvider } from './src/contexts/AppContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootApp } from './src/screens/RootApp';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <RootApp />
      </AppProvider>
    </ErrorBoundary>
  );
}
