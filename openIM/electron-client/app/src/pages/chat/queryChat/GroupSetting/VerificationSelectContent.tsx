import { CheckOutlined } from "@ant-design/icons";
import { GroupVerificationType } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Spin } from "antd";
import type { TFunction } from "i18next";
import { memo } from "react";
import { useTranslation } from "react-i18next";

export const getVerificationMenuList = (t: TFunction) => [
  {
    title: t("chat.group.applyNeedInvite"),
    type: GroupVerificationType.ApplyNeedInviteNot,
  },
  {
    title: t("chat.group.applyNeedVerification"),
    type: GroupVerificationType.AllNeed,
  },
  {
    title: t("chat.group.applyAll"),
    type: GroupVerificationType.AllNot,
  },
];

const VerificationSelectContent = memo(
  ({
    activeType,
    tryChange,
  }: {
    activeType?: GroupVerificationType;
    tryChange: (type: GroupVerificationType) => Promise<void>;
  }) => {
    const { t } = useTranslation();
    const verificationMenuList = getVerificationMenuList(t);
    const { mutateAsync: updateVerification, isPending } = useMutation({
      mutationFn: tryChange,
    });

    return (
      <Spin spinning={isPending}>
        <div className="p-1">
          {verificationMenuList.map((item) => (
            <div
              className="flex cursor-pointer items-center rounded p-3 pr-2 text-xs hover:bg-(--primary-active)"
              key={item.type}
              onClick={async () => {
                if (item.type !== activeType) {
                  await updateVerification(item.type);
                }
              }}
            >
              <div className="w-40">{item.title}</div>
              {activeType === item.type && (
                <CheckOutlined className="text-primary" rev={undefined} />
              )}
            </div>
          ))}
        </div>
      </Spin>
    );
  },
);

export default VerificationSelectContent;
