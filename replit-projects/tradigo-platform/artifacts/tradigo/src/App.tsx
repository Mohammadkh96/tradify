import React, { useEffect } from 'react';
import { AppRouter } from './routes';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const initialize = useAuthStore(state => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <AppRouter />;
}
