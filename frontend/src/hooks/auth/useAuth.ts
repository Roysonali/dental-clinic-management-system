import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../../context/auth/authContext';

/**
 * Access the current auth session.
 *
 * Must be used within an `<AuthProvider>` (wraps the app in App.tsx).
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
