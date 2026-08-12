"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      theme="light"
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-[#2C2C2A] group-[.toaster]:border-[#E3E0DB] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:border-l-2 group-[.toaster]:border-l-[#7C3AED] group-[.toaster]:font-sans",
          description: "group-[.toast]:text-[#5F5E5A] group-[.toast]:text-xs group-[.toast]:mt-1",
          actionButton:
            "group-[.toast]:bg-[#7C3AED] group-[.toast]:text-white group-[.toast]:font-bold",
          cancelButton:
            "group-[.toast]:bg-[#EEEBE7] group-[.toast]:text-[#5F5E5A]",
          success: "group-[.toaster]:border-l-[#16A34A]",
          error: "group-[.toaster]:border-l-[#DC2626]",
          warning: "group-[.toaster]:border-l-[#F59E0B]",
          info: "group-[.toaster]:border-l-[#3B82F6]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
