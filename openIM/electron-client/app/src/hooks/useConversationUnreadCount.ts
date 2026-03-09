import { ConversationGroupAllKey } from "@/constants/im";
import { useConversationStore } from "@/store";

export function useConversationUnreadCount() {
  const { activeConversationGroup, unReadCount } = useConversationStore((state) => ({
    activeConversationGroup: state.activeConversationGroup,
    unReadCount: state.unReadCount,
  }));

  if (activeConversationGroup === ConversationGroupAllKey) {
    return unReadCount;
  }
  return activeConversationGroup.unreadCount ?? 0;
}
