import { RightOutlined } from "@ant-design/icons";
import { ConversationItem } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Modal, Select, Space, Spin } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import SettingRow from "@/components/SettingRow";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { feedbackToast } from "@/utils/feedback";

const MsgDestructSetting = ({
  currentConversation,
  updateConversationMsgDestructState,
  updateDestructDuration,
}: {
  currentConversation?: ConversationItem;
  updateConversationMsgDestructState: () => Promise<void>;
  updateDestructDuration: (seconds: number) => Promise<void>;
}) => {
  const destructModalRef = useRef<OverlayVisibleHandle>(null);

  return (
    <>
      <SettingRow
        className="pb-2"
        title={t("chat.conversation.messageDestruct")}
        value={currentConversation?.isMsgDestruct}
        tryChange={updateConversationMsgDestructState}
      />
      {currentConversation?.isMsgDestruct && (
        <>
          <SettingRow
            className="cursor-pointer"
            title={t("chat.conversation.messageDestructTime")}
            value={false}
            rowClick={() => destructModalRef.current?.openOverlay()}
          >
            <div className="flex items-center">
              <span className="mr-1 text-xs text-(--sub-text)">
                {getDestructStr(currentConversation?.msgDestructTime ?? 86400)}
              </span>
              <RightOutlined rev={undefined} />
            </div>
          </SettingRow>
          <ForwardDestructDurationModal
            ref={destructModalRef}
            destructDuration={currentConversation?.msgDestructTime ?? 30}
            updateDestructDuration={updateDestructDuration}
          />
        </>
      )}
    </>
  );
};

export default MsgDestructSetting;

export const getDestructStr = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const weeks = Math.floor(days / 7);
  const month = Math.floor(weeks / 4);
  if (days <= 6) {
    return t("common.dateTime.relative.day", { num: days });
  } else if (weeks <= 6 && days % 7 === 0) {
    return t("common.dateTime.relative.weeks", { num: weeks });
  }
  return t("common.dateTime.relative.month", { num: month });
};

const timeUnitOptions = [
  {
    label: t("common.dateTime.label.day"),
    value: 86400,
  },
  {
    label: t("common.dateTime.label.week"),
    value: 86400 * 7,
  },
  {
    label: t("common.dateTime.label.month"),
    value: 86400 * 30,
  },
];

const DestructDurationModal: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  {
    destructDuration: number;
    updateDestructDuration: (seconds: number) => Promise<void>;
  }
> = ({ destructDuration, updateDestructDuration }, ref) => {
  const [optionState, setOptionState] = useState({
    number: 1,
    unit: 86400,
  });
  const { closeOverlay, isOverlayOpen } = useOverlayVisible(ref);

  const { mutateAsync: updateDestruct, isPending } = useMutation({
    mutationFn: updateDestructDuration,
  });

  useEffect(() => {
    const days = Math.floor(destructDuration / 86400);
    const weeks = Math.floor(days / 7);
    const month = Math.floor(weeks / 4);
    if (days <= 6) {
      setOptionState({
        number: days,
        unit: 86400,
      });
    } else if (weeks <= 6 && days % 7 === 0) {
      setOptionState({
        number: weeks,
        unit: 86400 * 7,
      });
    } else {
      setOptionState({
        number: month,
        unit: 86400 * 30,
      });
    }
  }, [destructDuration]);

  const handleNumberChange = (value: number) => {
    setOptionState((prev) => ({ ...prev, number: value }));
  };

  const handleUnitChange = (value: number) => {
    setOptionState((prev) => ({ ...prev, unit: value }));
  };

  const saveChange = async () => {
    try {
      await updateDestruct(optionState.number * optionState.unit);
    } catch (error) {
      feedbackToast({ error });
    }
    closeOverlay();
  };

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      destroyOnClose
      centered
      onCancel={closeOverlay}
      width={320}
      className="no-padding-modal"
    >
      <Spin spinning={isPending}>
        <div className="px-5.5 py-6">
          <div className="mb-1">{t("chat.conversation.messageDestruct")}</div>
          <div className="text-xs text-(--sub-text)">
            {t("chat.conversation.messageDestructToast")}
          </div>
          <div className="mt-5">
            <Space wrap>
              <Select
                style={{ width: 75 }}
                value={optionState.number}
                onChange={handleNumberChange}
                options={Array(7)
                  .fill(1)
                  .map((_, idx) => ({ label: idx + 1, value: idx + 1 }))}
              />
              <Select
                style={{ width: 75 }}
                value={optionState.unit}
                onChange={handleUnitChange}
                options={timeUnitOptions}
              />
            </Space>
          </div>
          <div className="mt-10 flex items-center justify-end">
            <div>
              <span className="mr-3 cursor-pointer" onClick={closeOverlay}>
                {t("common.text.cancel")}
              </span>
              <span className="text-primary cursor-pointer" onClick={saveChange}>
                {t("common.text.confirm")}
              </span>
            </div>
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

export const ForwardDestructDurationModal = memo(forwardRef(DestructDurationModal));
