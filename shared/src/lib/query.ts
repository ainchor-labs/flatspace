/**
 * TanStack Query setup + shared auth hooks (`@flatspace/shared/lib`).
 *
 * All server state in the suite flows through React Query. This module provides
 * the configured QueryClient factory and the auth hooks every app reuses
 * (current user, login, register, logout).
 */

import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api, ApiRequestError } from "./api.ts";
import type {
  AuthResponse,
  Credentials,
  Tag,
  TagEntityType,
  TagWithCount,
  User,
  UserRole,
} from "../types/index.ts";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => {
          // Never retry auth failures — surface them immediately.
          if (error instanceof ApiRequestError && error.statusCode === 401) return false;
          return count < 2;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const authKeys = {
  me: ["auth", "me"] as const,
  setup: ["auth", "setup-status"] as const,
  users: ["admin", "users"] as const,
};

/** First-run check: true until the first (admin) account is created. */
export function useSetupStatus(): UseQueryResult<{ needsSetup: boolean }> {
  return useQuery({
    queryKey: authKeys.setup,
    queryFn: () => api.get<{ needsSetup: boolean }>("/auth/setup-status"),
    staleTime: Infinity,
  });
}

/** Admin: all user accounts. */
export function useUsers(): UseQueryResult<User[]> {
  return useQuery({
    queryKey: authKeys.users,
    queryFn: () => api.get<User[]>("/admin/users"),
  });
}

export function useCreateUser(): UseMutationResult<
  User,
  Error,
  { username: string; password: string; role: UserRole }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<User>("/admin/users", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.users }),
  });
}

export function useUpdateUser(): UseMutationResult<
  User,
  Error,
  { id: number; role?: UserRole; password?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }) => api.patch<User>(`/admin/users/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.users }),
  });
}

export function useDeleteUser(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.users }),
  });
}

/** Current user, or null when not authenticated (401 is treated as "logged out"). */
export function useCurrentUser(): UseQueryResult<User | null> {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        const res = await api.get<AuthResponse>("/auth/me");
        return res.user;
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 401) return null;
        throw err;
      }
    },
  });
}

export function useLogin(): UseMutationResult<User, Error, Credentials> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (creds: Credentials) => {
      const res = await api.post<AuthResponse>("/auth/login", creds);
      return res.user;
    },
    onSuccess: (user) => qc.setQueryData(authKeys.me, user),
  });
}

export function useRegister(): UseMutationResult<User, Error, Credentials> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (creds: Credentials) => {
      const res = await api.post<AuthResponse>("/auth/register", creds);
      return res.user;
    },
    onSuccess: (user) => qc.setQueryData(authKeys.me, user),
  });
}

/** Update your own profile (avatar color and/or password). */
export function useUpdateProfile(): UseMutationResult<
  User,
  Error,
  { avatarColor?: string; currentPassword?: string; newPassword?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch) => {
      const res = await api.patch<AuthResponse>("/auth/me", patch);
      return res.user;
    },
    onSuccess: (user) => qc.setQueryData(authKeys.me, user),
  });
}

/* ------------------------------------------------------------------ */
/* Tags (shared, cross-app labels)                                    */
/* ------------------------------------------------------------------ */

export const tagKeys = {
  all: ["tags"] as const,
};

// App list/detail queries embed each item's tags, so a tag change must refresh
// them too. These are the query-key roots whose data carries embedded tags.
const TAGGED_QUERY_ROOTS = ["tags", "flatfile", "flatdeck", "flatdrive", "flatthoughts"];

function invalidateTagged(qc: ReturnType<typeof useQueryClient>): void {
  for (const root of TAGGED_QUERY_ROOTS) qc.invalidateQueries({ queryKey: [root] });
}

/** All of the current user's tags, with usage counts. */
export function useTags(): UseQueryResult<TagWithCount[]> {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: () => api.get<TagWithCount[]>("/tags"),
  });
}

export function useCreateTag(): UseMutationResult<Tag, Error, { name: string; color: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Tag>("/tags", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useUpdateTag(): UseMutationResult<
  Tag,
  Error,
  { id: number; name?: string; color?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }) => api.patch<Tag>(`/tags/${id}`, patch),
    // Name/color changes show on chips across every app.
    onSuccess: () => invalidateTagged(qc),
  });
}

export function useDeleteTag(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/tags/${id}`),
    onSuccess: () => invalidateTagged(qc),
  });
}

/** Replace an entity's full tag set. */
export function useSetEntityTags(): UseMutationResult<
  Tag[],
  Error,
  { entityType: TagEntityType; entityId: number; tagIds: number[] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.put<Tag[]>("/tags/entity", input),
    onSuccess: () => invalidateTagged(qc),
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: () => {
      qc.setQueryData(authKeys.me, null);
      qc.clear();
    },
  });
}
