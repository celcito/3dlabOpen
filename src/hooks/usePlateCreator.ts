import { useState } from "react";

export function usePlateCreator() {
  const [successMsg, setSuccessMsg] = useState("");
  const showSuccessNotification = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 3500);
  };
  return { successMsg, showSuccessNotification };
}
