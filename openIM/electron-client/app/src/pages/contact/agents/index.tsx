import { Empty } from "antd";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import emitter from "@/utils/window/events";

export const Agents = () => {
  const { t } = useTranslation();
  const agents = useContactStore((state) => state.agents);
  const getAgentsListByReq = useContactStore((state) => state.getAgentsListByReq);

  useEffect(() => {
    getAgentsListByReq();
  }, []);

  const showUserCard = useCallback((userID: string) => {
    emitter.emit("OPEN_USER_CARD", {
      userID,
    });
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="m-5.5 text-base font-extrabold">{t("common.text.agents")}</div>
      {!agents.length ? (
        <Empty className="mt-[30%]" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="mt-4 ml-4 flex-1 overflow-auto pr-4">
          {agents.map((agent) => (
            <div
              key={agent.userID}
              className="flex items-center rounded-md px-3.5 pt-2.5 pb-3 transition-colors hover:bg-(--primary-active)"
              onClick={() => showUserCard(agent.userID)}
            >
              <OIMAvatar src={agent.faceURL} text={agent.nickname} />
              <div className="ml-3 truncate text-sm">{agent.nickname}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
