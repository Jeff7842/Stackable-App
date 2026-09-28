"use client";

/**
 * Select - native <select> in the shared control shell (keeps mobile pickers,
 * keyboard type-ahead and a11y for free).
 *
 *   <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
 *     <option value="">All grades</option>
 *     <option value="7">Grade 7</option>
 *   </Select>
 *
 * Same props as Input where they make sense: size, leftIcon, invalid, pill,
 * className (outer box), selectClassName (native element), ref -> <select>.
 * Inside a <Field> the id / aria wiring is automatic.
 */
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useFieldContext } from "./Field";
import { CONTROL_HEIGHT, CONTROL_INNER, CONTROL_PAD, ICON_PX, controlShell, type ControlSize } from "./controlStyles";

export interface SelectProps extends Omit<ComponentPropsWithRef<"select">, "size"> {
  size?: ControlSize;
  leftIcon?: string;
  invalid?: boolean;
  pill?: boolean;
  selectClassName?: string;
}

export function Select({
  size = "md",
  leftIcon,
  invalid,
  pill,
  className,
  selectClassName,
  id,
  required,
  ref,
  children,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...rest
}: SelectProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const describedBy = [describedByProp, field?.describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={controlShell({ invalid: isInvalid, pill, className: cn(CONTROL_HEIGHT[size], CONTROL_PAD[size], className) })}>
      {leftIcon ? <Icon icon={leftIcon} width={ICON_PX[size]} className="shrink-0 text-muted" /> : null}
      <select
        {...rest}
        ref={ref}
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={ariaInvalidProp ?? (isInvalid || undefined)}
        aria-describedby={describedBy}
        className={cn(CONTROL_INNER, "h-full cursor-pointer appearance-none pr-6", selectClassName)}
      >
        {children}
      </select>
      <Icon
        icon="solar:alt-arrow-down-linear"
        width={ICON_PX[size]}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export default Select;
