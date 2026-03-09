import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { oAuthLogin, oAuthRegister } from "@/api/services/auth";
import { setIMProfile } from "@/utils/storage";

export function OAuthCallback() {
  const navigate = useNavigate();
  const { mutateAsync: runOAuth } = useMutation({
    mutationFn: (payload: { state: string; registered: boolean }) => {
      const func = payload.registered ? oAuthLogin : oAuthRegister;
      return func(payload.state);
    },
  });
  useEffect(() => {
    handleOAuth();
  }, []);

  const handleOAuth = async () => {
    if (window.electronAPI) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const oauth_state = params.get("oauth_state");
    const oauth_registered = params.get("oauth_registered");
    if (!oauth_state || !oauth_registered) {
      navigate("/login");
      return;
    }

    try {
      const data = await runOAuth({
        state: oauth_state,
        registered: oauth_registered === "true",
      });
      const { chatToken, imToken, userID } = data.data;
      setIMProfile({ chatToken, imToken, userID });
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/chat", { replace: true });
    } catch (error) {
      navigate("/login");
    }
  };

  return <div>loading...</div>;
}
