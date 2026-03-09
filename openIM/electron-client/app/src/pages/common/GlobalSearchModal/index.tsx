import { SearchOutlined } from "@ant-design/icons";
import {
  FriendUserItem,
  GroupItem,
  SearchMessageResultItem,
} from "@openim/wasm-client-sdk";
import { useDebounceFn, useKeyPress } from "ahooks";
import { Input, InputRef, Modal, Tabs } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useSearchChatLogs,
  useSearchColleagues,
  useSearchFriends,
  useSearchGroups,
  useSearchHistoryFiles,
} from "@/api/hooks/search";
import { BusinessUserInfo } from "@/api/services/user";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { getConversationContent } from "@/utils/imCommon";

import ChatLogsPanel from "./ChatLogsPanel";
import ContactPanel from "./ContactPanel";
import DashboardPanel from "./DashboardPanel";
import FilePanel, { MessageItemForFilePanel } from "./FilePanel";
import styles from "./index.module.scss";

export interface SearchData<T> {
  data: T[];
  loading: boolean;
}

export type ChatLogsItem = SearchMessageResultItem & {
  sendTime: number;
  description: string;
};

const TabKeys = [
  "DashBoard",
  "Friends",
  "Colleagues",
  "Groups",
  "ChatLogs",
  "HistoryFiles",
  "Conversations",
] as const;

export type TabKey = (typeof TabKeys)[number];

const GlobalSearchModal: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  const isOrganizationMember = useUserStore((state) =>
    state.organizationInfoList.length > 0,
  );

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={isOverlayOpen}
      closable={false}
      width={"70%"}
      destroyOnClose
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
        body: {
          height: "70vh",
          minHeight: "400px",
        },
      }}
      className={"no-padding-modal max-w-200"}
      maskTransitionName=""
    >
      <GlobalSearchContent
        closeOverlay={closeOverlay}
        isOrganizationMember={isOrganizationMember}
      />
    </Modal>
  );
};

export const GlobalSearchContent = ({
  isOrganizationMember,
  closeOverlay,
}: {
  isOrganizationMember: boolean;
  closeOverlay: () => void;
}) => {
  const [activeKey, setActiveKey] = useState<TabKey>("DashBoard");
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const searchBarRef = useRef<SearchBarHandle>(null);
  const chatLogRef = useRef<{ updateIdx: (idx: number) => void }>(null);
  const lastErrorRef = useRef<{ keyword: string; reported: Set<string> }>({
    keyword: "",
    reported: new Set<string>(),
  });

  const searchEnabled = Boolean(searchKeyword);
  const friendsQuery = useSearchFriends(searchKeyword, searchEnabled);
  const colleaguesQuery = useSearchColleagues(
    searchKeyword,
    searchEnabled && isOrganizationMember,
  );
  const groupsQuery = useSearchGroups(searchKeyword, searchEnabled);
  const chatLogsQuery = useSearchChatLogs(searchKeyword, searchEnabled);
  const historyFilesQuery = useSearchHistoryFiles(searchKeyword, searchEnabled);

  const friends: SearchData<FriendUserItem> = useMemo(
    () => ({
      data: searchEnabled ? (friendsQuery.data ?? []) : [],
      loading: searchEnabled && (friendsQuery.isPending || friendsQuery.isFetching),
    }),
    [friendsQuery.data, friendsQuery.isFetching, friendsQuery.isPending, searchEnabled],
  );

  const colleagues: SearchData<BusinessUserInfo> = useMemo(
    () => ({
      data: searchEnabled ? (colleaguesQuery.data ?? []) : [],
      loading:
        searchEnabled && (colleaguesQuery.isPending || colleaguesQuery.isFetching),
    }),
    [
      colleaguesQuery.data,
      colleaguesQuery.isFetching,
      colleaguesQuery.isPending,
      searchEnabled,
    ],
  );

  const groups: SearchData<GroupItem> = useMemo(
    () => ({
      data: searchEnabled ? (groupsQuery.data ?? []) : [],
      loading: searchEnabled && (groupsQuery.isPending || groupsQuery.isFetching),
    }),
    [groupsQuery.data, groupsQuery.isFetching, groupsQuery.isPending, searchEnabled],
  );

  const chatLogsData = useMemo(() => {
    if (!searchEnabled) return [];
    return (chatLogsQuery.data ?? []).map((result) => {
      const firstMessage = result.messageList?.[0];
      const description =
        result.messageCount > 1
          ? t("placeholder.relevantMessage", { count: result.messageCount })
          : firstMessage
            ? getConversationContent(firstMessage)
            : "";
      return {
        ...result,
        sendTime: firstMessage?.sendTime ?? 0,
        description,
      } as ChatLogsItem;
    });
  }, [chatLogsQuery.data, searchEnabled, t]);

  const chatLogs: SearchData<ChatLogsItem> = useMemo(
    () => ({
      data: chatLogsData,
      loading: searchEnabled && (chatLogsQuery.isPending || chatLogsQuery.isFetching),
    }),
    [chatLogsData, chatLogsQuery.isFetching, chatLogsQuery.isPending, searchEnabled],
  );

  const historyFiles: SearchData<MessageItemForFilePanel> = useMemo(
    () => ({
      data: searchEnabled ? (historyFilesQuery.data ?? []) : [],
      loading:
        searchEnabled && (historyFilesQuery.isPending || historyFilesQuery.isFetching),
    }),
    [
      historyFilesQuery.data,
      historyFilesQuery.isFetching,
      historyFilesQuery.isPending,
      searchEnabled,
    ],
  );

  useEffect(() => {
    if (!searchEnabled) {
      lastErrorRef.current = { keyword: "", reported: new Set<string>() };
      return;
    }
    if (lastErrorRef.current.keyword !== searchKeyword) {
      lastErrorRef.current = { keyword: searchKeyword, reported: new Set<string>() };
    }
    const errors = [
      {
        id: "friends",
        error: friendsQuery.error,
        msg: t("chat.toast.searchFriendsFailed"),
      },
      {
        id: "colleagues",
        error: colleaguesQuery.error,
        msg: t("chat.toast.searchColleaguesFailed"),
      },
      {
        id: "groups",
        error: groupsQuery.error,
        msg: t("chat.toast.searchGroupsFailed"),
      },
      {
        id: "chatLogs",
        error: chatLogsQuery.error,
        msg: t("chat.toast.searchChatLogsFailed"),
      },
      {
        id: "historyFiles",
        error: historyFilesQuery.error,
        msg: t("chat.toast.searchHistoryFilesFailed"),
      },
    ];
    const { reported } = lastErrorRef.current;
    errors.forEach(({ id, error, msg }) => {
      if (!error || reported.has(id)) return;
      reported.add(id);
      feedbackToast({ error, msg });
    });
  }, [
    chatLogsQuery.error,
    colleaguesQuery.error,
    friendsQuery.error,
    groupsQuery.error,
    historyFilesQuery.error,
    searchEnabled,
    searchKeyword,
    t,
  ]);

  useEffect(() => {
    if (location.hash.startsWith("#/contact")) {
      setActiveKey("Friends");
    }
    searchBarRef.current?.focus();
    return () => {
      resetState();
    };
  }, []);

  useKeyPress("leftarrow", () => {
    const currentIndex = TabKeys.indexOf(activeKey);
    if (currentIndex > 0) {
      setActiveKey(TabKeys[currentIndex - 1]);
    }
  });

  useKeyPress("rightarrow", () => {
    const currentIndex = TabKeys.indexOf(activeKey);
    if (currentIndex < TabKeys.length - 1) {
      setActiveKey(TabKeys[currentIndex + 1]);
    }
  });

  const toggleTab = useCallback((tab: TabKey) => {
    setActiveKey(tab);
  }, []);

  const toggleChatLogActive = useCallback(
    (idx: number) => chatLogRef.current?.updateIdx(idx),
    [],
  );

  const resetState = () => {
    setActiveKey("DashBoard");
    setKeyword("");
    setSearchKeyword("");
    searchBarRef.current?.clearKeyword();
  };

  const tabs = [
    {
      key: "DashBoard",
      label: t("common.text.overview"),
      visible: true,
      children: (
        <DashboardPanel
          isActive={activeKey === "DashBoard"}
          friends={friends}
          colleagues={colleagues}
          groups={groups}
          chatLogs={chatLogs}
          keyword={keyword}
          historyFiles={historyFiles}
          // conversations={conversations}
          closeOverlay={closeOverlay}
          toggleTab={toggleTab}
          toggleChatLogActive={toggleChatLogActive}
        />
      ),
    },
    {
      key: "Friends",
      label: t("common.text.contacts"),
      visible: true,
      children: (
        <ContactPanel
          isActive={activeKey === "Friends"}
          {...friends}
          closeOverlay={closeOverlay}
        />
      ),
    },
    {
      key: "Colleagues",
      label: t("common.text.organization"),
      visible: isOrganizationMember,
      children: (
        <ContactPanel
          isActive={activeKey === "Colleagues"}
          {...colleagues}
          closeOverlay={closeOverlay}
        />
      ),
    },
    {
      key: "Groups",
      label: t("chat.group.myGroup"),
      visible: true,
      children: (
        <ContactPanel
          isActive={activeKey === "Groups"}
          {...groups}
          closeOverlay={closeOverlay}
        />
      ),
    },
    {
      key: "ChatLogs",
      label: t("chat.message.messageHistory"),
      visible: true,
      children: (
        <ChatLogsPanel
          ref={chatLogRef}
          isActive={activeKey === "ChatLogs"}
          keyword={keyword}
          {...chatLogs}
          closeOverlay={closeOverlay}
        />
      ),
    },
    {
      key: "HistoryFiles",
      label: t("common.text.document"),
      visible: true,
      children: <FilePanel isActive={activeKey === "HistoryFiles"} {...historyFiles} />,
    },
    // {
    //   key: "Conversations",
    //   label: t("common.text.conversation"),
    //   children: (
    //     <ConversationPanel
    //       isActive={activeKey === "Conversations"}
    //       {...conversations}
    //       closeOverlay={closeOverlay}
    //     />
    //   ),
    // },
  ];

  const triggerSearch = (value: string) => {
    setSearchKeyword(value.trim());
  };

  return (
    <div className={styles["global-search-content"]}>
      <ForWardSearchBar
        ref={searchBarRef}
        triggerSearch={triggerSearch}
        onKeywordChange={setKeyword}
      />
      <Tabs
        className={styles["search-tab"]}
        defaultActiveKey="DashBoard"
        activeKey={activeKey}
        items={tabs}
        onChange={toggleTab as (key: string) => void}
      />
    </div>
  );
};

export default memo(forwardRef(GlobalSearchModal));

type SearchBarHandle = { clearKeyword: () => void; focus: () => void };

const SearchBar: ForwardRefRenderFunction<
  SearchBarHandle,
  { triggerSearch: (value: string) => void; onKeywordChange: (value: string) => void }
> = ({ triggerSearch, onKeywordChange }, ref) => {
  const inputRef = useRef<InputRef>(null);
  const [keyword, setKeyword] = useState("");

  const { run: debounceSearch } = useDebounceFn(triggerSearch, { wait: 500 });

  const onChange = (value: string) => {
    const trimmedValue = value.trim();
    setKeyword(value);
    onKeywordChange(trimmedValue);
    debounceSearch(trimmedValue);
  };

  useImperativeHandle(
    ref,
    () => ({
      clearKeyword: () => {
        setKeyword("");
        onKeywordChange("");
        triggerSearch("");
      },
      focus: () => inputRef.current?.focus(),
    }),
    [onKeywordChange, triggerSearch],
  );

  return (
    <>
      <div className="app-drag flex-shirk-0 h-6"></div>
      <div className="flex-shirk-0 px-6">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          ref={inputRef}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </>
  );
};

const ForWardSearchBar = memo(forwardRef(SearchBar));
