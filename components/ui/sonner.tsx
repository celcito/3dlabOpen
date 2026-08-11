"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-white group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg group-[.toaster]:rounded-none group-[.toaster]:border-l-2 group-[.toaster]:border-l-[#00E5FF] group-[.toaster]:font-sans",
          description: "group-[.toast]:text-zinc-400 group-[.toast]:text-xs group-[.toast]:mt-1",
          actionButton:
            "group-[.toast]:bg-[#00E5FF] group-[.toast]:text-black group-[.toast]:font-bold",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300",
          success: "group-[.toaster]:border-l-emerald-400",
          error: "group-[.toaster]:border-l-red-500",
          warning: "group-[.toaster]:border-l-yellow-400",
          info: "group-[.toaster]:border-l-[#00E5FF]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
