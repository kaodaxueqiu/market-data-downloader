import clsx from "clsx";

import OIMAvatar from "@/components/OIMAvatar";

type Member = {
  /** Unique user ID */
  userId: string;
  /** Display name */
  display: string;
  /** Optional avatar URL */
  avatarUrl?: string;
};

const MentionListItem = ({
  member,
  isSelected,
}: {
  member: Member;
  isSelected: boolean;
}) => {
  return (
    <div
      key={member.userId}
      className={clsx(
        "flex items-center rounded-md hover:bg-(--primary-active)",
        isSelected && "bg-(--primary-active)",
      )}
    >
      <OIMAvatar size={26} text={member.display} src={member.avatarUrl} />
      <div className="ml-2! max-w-50 truncate">{member.display}</div>
    </div>
  );
};

export default MentionListItem;
