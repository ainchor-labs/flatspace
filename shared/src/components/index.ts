/**
 * Public surface of the shared component library (`@flatspace/shared/ui`).
 */

// Primitives
export { Button, buttonVariants, type ButtonProps } from "./ui/button.tsx";
export { Input, type InputProps } from "./ui/input.tsx";
export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuLabel,
} from "./ui/menu.tsx";
export { ToastProvider, useToast, type ToastVariant } from "./ui/toast.tsx";
export { DialogProvider, useDialog } from "./ui/dialog.tsx";

// Shell + identity
export { AppShell, type AppShellProps } from "./AppShell.tsx";
export { AppSwitcher } from "./AppSwitcher.tsx";
export { Sidebar, SidebarSection, SidebarItem } from "./Sidebar.tsx";
export { Avatar } from "./Avatar.tsx";
export { Logo } from "./Logo.tsx";
export { UserMenu } from "./UserMenu.tsx";
export { AuthScreen } from "./AuthScreen.tsx";
export { CommandPalette, type Command } from "./CommandPalette.tsx";
