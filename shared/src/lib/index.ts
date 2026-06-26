/**
 * Public surface of the shared client lib (`@flatspace/shared/lib`).
 */

export { cn } from "./cn.ts";
export { api, ApiRequestError } from "./api.ts";
export {
  createQueryClient,
  authKeys,
  useCurrentUser,
  useLogin,
  useRegister,
  useLogout,
  useUpdateProfile,
  useSetupStatus,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  tagKeys,
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useSetEntityTags,
} from "./query.ts";
