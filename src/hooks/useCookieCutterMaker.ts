import { useState } from "react";

export function useCookieCutterMaker() {
  const [successMsg, setSuccessMsg] = useState("");
  const triggerSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 4000);
  };
  return { successMsg, triggerSuccess };
}
