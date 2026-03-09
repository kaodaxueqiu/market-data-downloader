import { CloseOutlined } from "@ant-design/icons";
import { GroupItem, GroupStatus, WSEvent } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Button, Input, InputRef } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { message } from "@/AntdGlobalComp";
import {
  BusinessUserInfo,
  RegisterType,
  searchBusinessUserInfo,
} from "@/api/services/user";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

import { IMSDK } from "../MainContentWrap";

interface ISearchUserOrGroupProps {
  isSearchGroup: boolean;
  openUserCardWithData: (data: CardInfo) => void;
  openGroupCardWithData: (data: GroupItem) => void;
}

const SearchUserOrGroup: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  ISearchUserOrGroupProps
> = ({ isSearchGroup, openUserCardWithData, openGroupCardWithData }, ref) => {
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<InputRef>(null);
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus());
    }
  }, [isOverlayOpen]);

  const checkUser = (user: BusinessUserInfo, keyword: string) => {
    const nomalCheck = user.userID === keyword || user.nickname === keyword;
    if (nomalCheck) return true;
    if (user.registerType === RegisterType.PhoneNumber) {
      return user.phoneNumber === keyword;
    }
    if (user.registerType === RegisterType.Email) {
      return user.email === keyword;
    }
    return user.account === keyword;
  };

  const { mutate: searchData, isPending: isSearching } = useMutation({
    mutationFn: async (keywordValue: string) => {
      if (isSearchGroup) {
        try {
          const { data } = await IMSDK.getSpecifiedGroupsInfo([keywordValue]);
          const groupInfo = data.find(
            (group) => group.status !== GroupStatus.Dismissed,
          );
          if (!groupInfo) {
            message.warning(t("common.empty.noSearchResults"));
            return;
          }
          openGroupCardWithData(groupInfo);
        } catch (error) {
          if ((error as WSEvent).errCode === 1004) {
            message.warning(t("common.empty.noSearchResults"));
            return;
          }
          feedbackToast({ error });
        }
        return;
      }

      try {
        const {
          data: { total, users },
        } = await searchBusinessUserInfo(keywordValue);
        if (!total || !checkUser(users[0], keywordValue)) {
          message.warning(t("common.empty.noSearchResults"));
          return;
        }
        const friendInfo = useContactStore
          .getState()
          .friendList.find((friend) => friend.userID === users[0].userID);

        openUserCardWithData({
          ...(friendInfo ?? {}),
          ...users[0],
        });
      } catch (error) {
        if ((error as WSEvent).errCode === 1004) {
          message.warning(t("common.empty.noSearchResults"));
          return;
        }
        feedbackToast({ error });
      }
    },
  });

  const searchByKeyword = () => {
    if (!keyword) return;
    searchData(keyword);
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={332}
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={() => {
        setKeyword("");
      }}
      ignoreClasses=".ignore-drag, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div className="flex h-12 items-center justify-between bg-(--gap-text) px-5.5">
        <div>
          {isSearchGroup ? t("common.text.addGroup") : t("common.text.addFriends")}
        </div>
        <CloseOutlined
          className="cursor-pointer text-(--sub-text)"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="ignore-drag">
        <div className="border-b border-(--gap-text) px-5.5 py-6">
          <Input.Search
            ref={inputRef}
            className="no-addon-search"
            placeholder={t("common.text.pleaseEnter")}
            value={keyword}
            addonAfter={null}
            spellCheck={false}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={searchByKeyword}
          />
        </div>
        <div className="flex justify-end px-5.5 py-2.5">
          <Button
            loading={isSearching}
            className="px-6"
            type="primary"
            disabled={!keyword}
            onClick={searchByKeyword}
          >
            {t("common.text.confirm")}
          </Button>
          <Button
            className="ml-3 border-0 bg-(--chat-bubble) px-6"
            onClick={closeOverlay}
          >
            {t("common.text.cancel")}
          </Button>
        </div>
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(SearchUserOrGroup));
