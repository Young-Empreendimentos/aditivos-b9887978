import { useAuth, type Role } from '@/contexts/AuthContext';

export interface Permissions {
  role: Role;
  isAdmin: boolean;
  isCoordinator: boolean;
  isCommon: boolean;
}

export function usePermission(): Permissions {
  const { role } = useAuth();
  return {
    role,
    isAdmin: role === 'admin',
    isCoordinator: role === 'coordinator' || role === 'admin',
    isCommon: true,
  };
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  coordinator: 'Coordenador',
  common: 'Usuário',
};
