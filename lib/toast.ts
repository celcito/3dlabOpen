import { toast as sonner } from "sonner";

type ToastType = "success" | "error" | "warning" | "info";

function show(type: ToastType, message: string, description?: string) {
  sonner[type](message, { description });
}

export const toast = {
  success: (message: string, description?: string) => show("success", message, description),
  error: (message: string, description?: string) => show("error", message, description),
  warning: (message: string, description?: string) => show("warning", message, description),
  info: (message: string, description?: string) => show("info", message, description),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

export function toastExportError(filename?: string) {
  const name = filename ? ` ${filename}` : "";
  toast.error(`Erro ao exportar${name}.`, "Tente novamente ou verifique o arquivo.");
}

export function toastInvalidFormat(accepted: string[]) {
  toast.warning("Formato não suportado.", `Aceitos: ${accepted.join(", ")}`);
}

export function toastParseError(format: string) {
  toast.error(`Falha ao ler ${format}.`, "Arquivo corrompido ou incompatível.");
}

export function toastActionSuccess(action: string) {
  toast.success(action);
}

export function toastActionError(action: string, reason?: string) {
  toast.error(action, reason);
}

export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string }
) {
  return sonner.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
}
