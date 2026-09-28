"use client";

/**
 * Input - text-like input with optional left icon and right adornment.
 *
 *   <Input placeholder="Search students" leftIcon="solar:magnifer-linear" />
 *   <Input type="password" rightAdornment={<button type="button">Show</button>} invalid />
 *
 * - `className` styles the outer box (use it for width, e.g. "max-w-xs");
 *   `inputClassName` styles the native <input>. `ref` reaches the <input>.
 * - `size`: sm | md | lg (native `size` attribute is not supported).
 * - `pill`: fully rounded (used for search).
 * - `invalid`: error ring. Inside a <Field> this, `id`, `aria-describedby`
 *   and `required` are wired automatically.
 */
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useFieldContext } from "./Field";
import { CONTROL_HEIGHT, CONTROL_INNER, CONTROL_PAD, ICON_PX, controlShell, type ControlSize } from "./controlStyles";

export interface InputProps extends Omit<ComponentPropsWithRef<"input">, "size"> {
  size?: ControlSize;
  leftIcon?: string;
  rightAdornment?: ReactNode;
  invalid?: boolean;
  pill?: boolean;
  inputClassName?: string;
}

export function Input({
  size = "md",
  leftIcon,
  rightAdornment,
  invalid,
  pill,
  className,
  inputClassName,
  id,
  required,
  ref,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...rest
}: InputProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const describedBy = [describedByProp, field?.describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={controlShell({ invalid: isInvalid, pill, className: cn(CONTROL_HEIGHT[size], CONTROL_PAD[size], className) })}>
      {leftIcon ? (
        <Icon icon={leftIcon} width={ICON_PX[size]} className="shrink-0 text-muted" />
      ) : null}
      <input
        {...rest}
        ref={ref}
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={ariaInvalidProp ?? (isInvalid || undefined)}
        aria-describedby={describedBy}
        className={cn(CONTROL_INNER, "h-full", inputClassName)}
      />
      {rightAdornment ? <div className="flex shrink-0 items-center text-muted">{rightAdornment}</div> : null}
    </div>
  );
}

export default Input;
