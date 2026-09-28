"use client";

/**
 * Textarea - multi-line input in the shared control shell.
 *
 *   <Field label="Notes"><Textarea rows={4} placeholder="Anything to add?" /></Field>
 *
 * `className` styles the outer box, `textareaClassName` the native element,
 * `ref` reaches the <textarea>. `invalid`, `id`, `aria-describedby` and
 * `required` are wired automatically inside a <Field>.
 */
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { useFieldContext } from "./Field";
import { CONTROL_INNER, controlShell } from "./controlStyles";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
  textareaClassName?: string;
}

export function Textarea({
  invalid,
  className,
  textareaClassName,
  id,
  required,
  ref,
  rows = 4,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...rest
}: TextareaProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const describedBy = [describedByProp, field?.describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={controlShell({ invalid: isInvalid, multiline: true, className: cn("px-3 py-2.5 text-sm", className) })}>
      <textarea
        {...rest}
        ref={ref}
        rows={rows}
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={ariaInvalidProp ?? (isInvalid || undefined)}
        aria-describedby={describedBy}
        className={cn(CONTROL_INNER, "min-h-20 resize-y leading-relaxed", textareaClassName)}
      />
    </div>
  );
}

export default Textarea;
