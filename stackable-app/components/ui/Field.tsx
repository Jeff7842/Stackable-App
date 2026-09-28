"use client";

/**
 * Field - label + control + hint/error, with the accessibility wiring done for you.
 *
 *   <Field label="Email" hint="We never share it." error={errors.email} required>
 *     <Input type="email" value={email} onChange={...} />
 *   </Field>
 *
 * Any Input / Select / Textarea rendered inside a Field automatically receives
 * `id` (so the <label htmlFor> works), `aria-describedby` (hint / error text),
 * `aria-invalid` (when `error` is set) and `required`. Explicit props on the
 * control win. Do not give the control its own `id` unless you also pass the
 * same value as `htmlFor` here.
 *
 * Render-prop form for custom controls:
 *   <Field label="Colour">{(c) => <MyPicker id={c.id} aria-describedby={c.describedBy} />}</Field>
 *
 * The error replaces the hint while it is shown.
 */
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface FieldControlProps {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControlProps | null>(null);

/** Used by Input / Select / Textarea. Returns null outside a Field. */
export function useFieldContext(): FieldControlProps | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  /** Error text. Presence marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Override the generated control id. */
  htmlFor?: string;
  className?: string;
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
}

export function Field({ label, hint, error, required = false, htmlFor, className, children }: FieldProps) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : hint ? hintId : undefined;

  const control: FieldControlProps = { id, describedBy, invalid: hasError, required };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <FieldContext.Provider value={control}>
        {typeof children === "function" ? children(control) : children}
      </FieldContext.Provider>

      {hasError ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <Icon icon="solar:danger-circle-linear" width={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default Field;
