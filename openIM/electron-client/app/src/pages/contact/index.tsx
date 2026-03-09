import { Outlet } from "react-router-dom";

import { ResizableChatLayout } from "@/components/ResizableChatLayout";
import ContactSider from "@/pages/contact/ContactSider";

export const Contact = () => {
  return <ResizableChatLayout sider={<ContactSider />} main={<Outlet />} />;
};
