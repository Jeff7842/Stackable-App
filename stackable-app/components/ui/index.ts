/**
 * Dashboard UI kit barrel. Import from "@/components/ui".
 * Only files that exist are exported here. StatCard lives at
 * "@/components/cards/card" (default export).
 */
export { Icon, type IconProps } from "./Icon";
export { Avatar, type AvatarProps, type AvatarSize, type AvatarStatus } from "./Avatar";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ComingSoon, type ComingSoonProps } from "./ComingSoon";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Field, useFieldContext, type FieldProps, type FieldControlProps } from "./Field";
export { Input, type InputProps } from "./Input";
export { Select, type SelectProps } from "./Select";
export { Textarea, type TextareaProps } from "./Textarea";
export { Tabs, type TabsProps, type TabItem } from "./Tabs";
export { Drawer, type DrawerProps, type DrawerSize } from "./Drawer";
export { DataTable, type DataTableProps } from "./DataTable";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export {
  AnimatedNumber,
  useCountUp,
  usePrefersReducedMotion,
  type AnimatedNumberProps,
  type UseCountUpOptions,
} from "./AnimatedNumber";
