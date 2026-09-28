"use client";

/**
 * LogoUploader - preview + "Upload logo" + a logo-URL field.
 *
 * Presentational only: the drawer owns the upload mutation (POST
 * /api/school/logo through hooks/useSchools), the client-side file checks and
 * the toasts, and passes `uploading` back in. Picking a file resets the native
 * input so choosing the same file twice still fires.
 */
import { useRef } from "react";
import { Avatar, Button, Field, Input } from "@/components/ui";

export interface LogoUploaderProps {
  /** Current logo URL ("" = none). */
  value: string;
  /** School name, used for the initials fallback. */
  name: string;
  uploading: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  onUrlChange: (url: string) => void;
}

export function LogoUploader({ value, name, uploading, disabled = false, onFile, onUrlChange }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <Avatar name={name || "School"} src={value || null} size="xl" />

      <div className="w-full min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon="solar:upload-minimalistic-linear"
            loading={uploading}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading" : "Upload school logo"}
          </Button>
          {value ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="solar:trash-bin-minimalistic-linear"
              disabled={disabled || uploading}
              onClick={() => onUrlChange("")}
            >
              Remove
            </Button>
          ) : null}
        </div>

        <Field label="Logo URL" hint="Uploads fill this in for you. You can also paste a link to an image.">
          <Input
            type="url"
            inputMode="url"
            placeholder="Uploaded logo URL will appear here"
            value={value}
            disabled={disabled || uploading}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        </Field>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first so picking the same file again still triggers onChange.
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
    </div>
  );
}
