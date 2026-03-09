import { Group, Panel, Separator } from "react-resizable-panels";

type ResizableChatLayoutProps = {
  sider: React.ReactNode;
  main: React.ReactNode;
};

export const ResizableChatLayout = ({ sider, main }: ResizableChatLayoutProps) => {
  return (
    <Group orientation="horizontal">
      <Panel defaultSize={280} maxSize={"45%"} minSize={240}>
        {sider}
      </Panel>
      <Separator className="cursor-col-resize border-r border-(--gap-text) outline-none focus:outline-none focus-visible:outline-none" />
      <Panel>{main}</Panel>
    </Group>
  );
};
