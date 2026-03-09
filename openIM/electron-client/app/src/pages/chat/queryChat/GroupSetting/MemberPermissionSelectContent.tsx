import { CheckOutlined } from "@ant-design/icons";
import { AllowType } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Spin } from "antd";
import { t } from "i18next";
import { memo } from "react";

import { PermissionField } from "./useGroupSettings";

const memberPermissionList = [
  {
    title: t("chat.group.forbidLookMemberInfo"),
    field: "lookMemberInfo",
  },
  {
    title: t("chat.group.forbidAddMember"),
    field: "applyMemberFriend",
  },
];

const MemberPermissionSelectContent = memo(
  ({
    applyMemberFriend,
    lookMemberInfo,
    tryChange,
  }: {
    applyMemberFriend?: AllowType;
    lookMemberInfo?: AllowType;
    tryChange: (rule: AllowType, field: PermissionField) => Promise<void>;
  }) => {
    const { mutateAsync: updatePermission, isPending } = useMutation({
      mutationFn: ({ rule, field }: { rule: AllowType; field: PermissionField }) =>
        tryChange(rule, field),
    });

    return (
      <Spin spinning={isPending}>
        <div className="p-1">
          {memberPermissionList.map((item) => {
            const rule =
              item.field === "applyMemberFriend" ? applyMemberFriend : lookMemberInfo;
            return (
              <div
                className="flex cursor-pointer items-center rounded p-3 pr-1 text-xs hover:bg-(--primary-active)"
                key={item.field}
                onClick={async () => {
                  await updatePermission({
                    rule: Number(!rule) as AllowType,
                    field: item.field as PermissionField,
                  });
                }}
              >
                <div className="w-44">{item.title}</div>
                <div className="w-4">
                  {rule === AllowType.NotAllowed && (
                    <CheckOutlined className="text-primary" rev={undefined} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Spin>
    );
  },
);

export default MemberPermissionSelectContent;
