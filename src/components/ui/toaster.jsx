import { useToast } from "@/components/ui/use-toast";
import { ToastNotification, resolveToastVariant } from "@/components/ui/toast-notification";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-6 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-8 sm:right-6"
      aria-live="polite"
    >
      {toasts.filter((item) => item.open !== false).map((item) => (
        <ToastNotification
          key={item.id}
          title={item.title}
          message={item.description}
          variant={resolveToastVariant(item.variant)}
          onClose={() => dismiss(item.id)}
        />
      ))}
    </div>
  );
}
