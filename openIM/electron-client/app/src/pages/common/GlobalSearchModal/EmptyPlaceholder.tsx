import { Empty } from "antd";

export function EmptyPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </div>
  );
}
