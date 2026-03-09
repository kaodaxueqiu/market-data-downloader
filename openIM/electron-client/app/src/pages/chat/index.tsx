import { Outlet } from "react-router-dom";

import { ResizableChatLayout } from "@/components/ResizableChatLayout";

import ConversationSider from "./ConversationSider";

export const Chat = () => {
  return <ResizableChatLayout sider={<ConversationSider />} main={<Outlet />} />;
};
