import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile-safe file picker trigger.
 *
 * Prefer this over `button` + `input.hidden` + `input.click()`.
 * iOS Safari blocks programmatic clicks on `display: none` file inputs.
 * Native <label htmlFor> association works on iOS, Android, and desktop.
 */
export default function FilePickerTrigger({
  accept = "image/*",
  onChange,
  disabled = false,
  className,
  children,
  multiple = false,
  inputRef,
  id: idProp,
  ...labelProps
}) {
  const autoId = useId();
  const id = idProp || autoId;

  return (
    <>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple || undefined}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <label
        htmlFor={disabled ? undefined : id}
        aria-disabled={disabled || undefined}
        className={cn(
          "cursor-pointer touch-manipulation",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
          className
        )}
        {...labelProps}
      >
        {children}
      </label>
    </>
  );
}
