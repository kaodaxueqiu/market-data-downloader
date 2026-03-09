import {
  ApplicationHandleResult,
  FriendApplicationItem,
  GroupApplicationItem,
} from "@openim/wasm-client-sdk";
import { Button, Popover, Spin } from "antd";
import { t } from "i18next";
import { memo, useCallback, useState } from "react";

import arrow from "@/assets/images/contact/arrowTopRight.png";
import MenuContent from "@/components/ApplicationItem/MenuContent";
import OIMAvatar from "@/components/OIMAvatar";
import { IMSDK } from "@/layout/MainContentWrap";
import { emit } from "@/utils/window/events";

export type ApplicationItemSource = FriendApplicationItem & GroupApplicationItem;

export type AccessFunction = (
  source: Partial<ApplicationItemSource>,
  isRecv: boolean,
) => Promise<void>;

const ApplicationItem = ({
  currentUserID,
  source,
  onAccept,
  onReject,
}: {
  source: Partial<ApplicationItemSource>;
  currentUserID: string;
  onAccept: AccessFunction;
  onReject: AccessFunction;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRecv = source.userID !== currentUserID && source.fromUserID !== currentUserID;
  const isGroup = Boolean(source.groupID);
  const showActionBtn =
    source.handleResult === ApplicationHandleResult.Unprocessed && isRecv;

  const getApplicationDesc = () => {
    if (isGroup) {
      return isRecv
        ? t("contact.message.request.applyToJoin")
        : t("contact.message.request.youApplyToJoin");
    }
    return isRecv
      ? t("contact.message.request.applyToFriend")
      : t("contact.message.request.applyToAdd");
  };

  const getTitle = () => {
    if (isGroup) {
      return isRecv ? source.nickname : source.groupName;
    }
    return isRecv ? source.fromNickname : source.toNickname;
  };

  const getStatusStr = () => {
    if (source.handleResult === ApplicationHandleResult.Agree) {
      return t("contact.message.request.agreed");
    }
    if (source.handleResult === ApplicationHandleResult.Reject) {
      return t("contact.message.request.refused");
    }
    return t("contact.message.request.pending");
  };

  const getAvatarUrl = () => {
    if (isGroup) {
      return isRecv ? source.userFaceURL : source.groupFaceURL;
    }
    return isRecv ? source.fromFaceURL : source.toFaceURL;
  };

  const loadingWrap = async (isAgree: boolean) => {
    setLoading(true);
    await (isAgree ? onAccept(source, isRecv) : onReject(source, isRecv));
    setLoading(false);
  };

  const tryShowCard = useCallback(async () => {
    if (isGroup) {
      const { data } = await IMSDK.getSpecifiedGroupsInfo([source.groupID!]);
      emit("OPEN_GROUP_CARD", data[0]);
      return;
    }
    window.userClick(isRecv ? source.fromUserID : source.toUserID);
  }, []);

  return (
    <Popover
      overlayClassName="common-menu-popover"
      placement="bottomLeft"
      title={null}
      arrow={false}
      open={showMenu}
      onOpenChange={(vis) => setShowMenu(vis)}
      content={
        <MenuContent application={source} closeMenu={() => setShowMenu(false)} />
      }
      trigger="contextMenu"
    >
      <Spin spinning={loading}>
        <div className="flex flex-row items-center justify-between p-3.5 transition-colors hover:bg-(--primary-active)">
          <div className="flex flex-row">
            <OIMAvatar
              src={getAvatarUrl()}
              text={getTitle()}
              isgroup={isGroup && !isRecv}
              onClick={tryShowCard}
            />
            <div className="ml-3">
              <p className="text-sm">{getTitle()}</p>
              <p className="pt-1.25 pb-2.5 text-xs">
                {getApplicationDesc()}
                {(isGroup || (!isGroup && !isRecv)) && (
                  <span className="ml-1 text-xs text-[#0289FAFF]">
                    {source.groupName || source.toNickname}
                  </span>
                )}
              </p>
              <p className="text-xs text-(--sub-text)">
                {t("contact.message.request.information")}:
              </p>
              <p className="text-xs text-(--sub-text)">{source.reqMsg}</p>
            </div>
          </div>

          {showActionBtn && (
            <div className="flex flex-row">
              <div className="mr-5.5 h-8 w-15">
                <Button
                  block={true}
                  size="small"
                  type="primary"
                  className="h-full! rounded-md! bg-[#0289fa]"
                  onClick={() => loadingWrap(true)}
                >
                  {t("contact.message.request.agree")}
                </Button>
              </div>
              <div className="h-8 w-15">
                <Button
                  block={true}
                  size="small"
                  onClick={() => loadingWrap(false)}
                  className="border-primary text-primary h-full! rounded-md! border-2"
                >
                  {t("contact.message.request.refuse")}
                </Button>
              </div>
            </div>
          )}

          {!showActionBtn && (
            <div className="flex flex-row items-center">
              {!isRecv && <img className="mr-2 h-4 w-4" src={arrow} alt="" />}
              <p className="text-sm text-(--sub-text)">{getStatusStr()}</p>
            </div>
          )}
        </div>
      </Spin>
    </Popover>
  );
};

export default memo(ApplicationItem);
