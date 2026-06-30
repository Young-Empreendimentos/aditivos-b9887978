import { useAuth, type Role } from '@/contexts/AuthContext';

export interface Permissions {
  role: Role | null;
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
    isCommon: role !== null,
  };
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  coordinator: 'Coordenador',
  common: 'Usuário',
};
