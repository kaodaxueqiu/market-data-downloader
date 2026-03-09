import {
  ApplicationHandleResult,
  FriendApplicationItem,
} from "@openim/wasm-client-sdk";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import ApplicationItem, { AccessFunction } from "@/components/ApplicationItem";
import { IMSDK } from "@/layout/MainContentWrap";
import { useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/feedback";
import { setFriendApplicationLatestTime } from "@/utils/storage";

export const NewFriends = () => {
  const { t } = useTranslation();
  const currentUserID = useUserStore((state) => state.selfInfo.userID);

  const recvFriendApplicationList = useContactStore(
    (state) => state.recvFriendApplicationList,
  );
  const sendFriendApplicationList = useContactStore(
    (state) => state.sendFriendApplicationList,
  );
  const updateRecvFriendApplication = useContactStore(
    (state) => state.updateRecvFriendApplication,
  );
  const updateSendFriendApplication = useContactStore(
    (state) => state.updateSendFriendApplication,
  );
  const updateUnHandleFriendApplicationCount = useContactStore(
    (state) => state.updateUnHandleFriendApplicationCount,
  );

  const friendApplicationList = sortArray(
    recvFriendApplicationList.concat(sendFriendApplicationList),
  );

  const getRecvFriendApplicationListByReq = useContactStore(
    (state) => state.getRecvFriendApplicationListByReq,
  );
  const getSendFriendApplicationListByReq = useContactStore(
    (state) => state.getSendFriendApplicationListByReq,
  );

  useEffect(() => {
    getRecvFriendApplicationListByReq();
    getSendFriendApplicationListByReq();
    setFriendApplicationLatestTime(Date.now());
    updateUnHandleFriendApplicationCount(0);
  }, []);

  const onAccept = useCallback(
    async (application: FriendApplicationItem, isRecv: boolean) => {
      try {
        await IMSDK.acceptFriendApplication({
          toUserID: application.fromUserID,
          handleMsg: "",
        });
        const newApplication = {
          ...application,
          handleResult: ApplicationHandleResult.Agree,
        };
        if (isRecv) {
          updateRecvFriendApplication(newApplication);
        } else {
          updateSendFriendApplication(newApplication);
        }
      } catch (error) {
        feedbackToast({ error });
      }
    },
    [],
  );

  const onReject = useCallback(
    async (application: FriendApplicationItem, isRecv: boolean) => {
      try {
        await IMSDK.refuseFriendApplication({
          toUserID: application.fromUserID,
          handleMsg: "",
        });
        const newApplication = {
          ...application,
          handleResult: ApplicationHandleResult.Reject,
        };
        if (isRecv) {
          updateRecvFriendApplication(newApplication);
        } else {
          updateSendFriendApplication(newApplication);
        }
      } catch (error) {
        feedbackToast({ error });
      }
    },
    [],
  );

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <p className="m-5.5 text-base font-extrabold">{t("contact.text.newFriends")}</p>
      <div className="flex-1 pb-3">
        <Virtuoso
          className="h-full overflow-x-hidden"
          data={friendApplicationList}
          itemContent={(_, item) => (
            <ApplicationItem
              key={`${
                currentUserID === item.fromUserID ? item.toUserID : item.fromUserID
              }${item.createTime}`}
              source={item}
              currentUserID={currentUserID}
              onAccept={onAccept as AccessFunction}
              onReject={onReject as AccessFunction}
            />
          )}
        />
      </div>
    </div>
  );
};

const sortArray = (list: FriendApplicationItem[]) => {
  list.sort((a, b) => {
    if (
      a.handleResult === ApplicationHandleResult.Unprocessed &&
      b.handleResult !== ApplicationHandleResult.Unprocessed
    ) {
      return -1;
    } else if (
      b.handleResult === ApplicationHandleResult.Unprocessed &&
      a.handleResult !== ApplicationHandleResult.Unprocessed
    ) {
      return 1;
    }
    return b.createTime - a.createTime;
  });
  return list;
};
