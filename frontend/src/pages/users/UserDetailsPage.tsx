import type { FC } from 'react';
import { UserDetailsContainer } from '../../components/users/containers/UserDetailsContainer';

/**
 * UserDetailsPage — /users/:userId route page.
 *
 * Thin route wrapper; the container owns loading, error handling,
 * activate/deactivate + role dialogs and navigation.
 */
export const UserDetailsPage: FC = () => {
  return <UserDetailsContainer />;
};
