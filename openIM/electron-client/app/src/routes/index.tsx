import { createHashRouter } from "react-router-dom";

import { MainContentLayout } from "@/layout/MainContentLayout";
import { MainContentWrap } from "@/layout/MainContentWrap";
import { EmptyChat } from "@/pages/chat/EmptyChat";
import { QueryChat } from "@/pages/chat/queryChat";

import contactRoutes from "./ContactRoutes";
import GlobalErrorElement from "./GlobalErrorElement";
import thirdRoutes from "./thirdRoutes";

const router = createHashRouter([
  {
    path: "/",
    element: <MainContentWrap />,
    errorElement: <GlobalErrorElement />,
    children: [
      {
        path: "/",
        element: <MainContentLayout />,
        children: [
          {
            path: "/chat",
            async lazy() {
              const { Chat } = await import("@/pages/chat");
              return { Component: Chat };
            },
            children: [
              {
                index: true,
                element: <EmptyChat />,
              },
              {
                path: ":conversationID",
                element: <QueryChat />,
              },
            ],
          },
          {
            path: "contact",
            async lazy() {
              const { Contact } = await import("@/pages/contact");
              return { Component: Contact };
            },
            children: contactRoutes,
          },
          {
            path: "favorites",
            async lazy() {
              const { Favorites } = await import("@/pages/favorites");
              return { Component: Favorites };
            },
          },
          {
            path: "skills",
            async lazy() {
              const { Skills } = await import("@/pages/skills");
              return { Component: Skills };
            },
          },
          {
            path: "agent-workspace",
            async lazy() {
              const { AgentWorkspace } = await import("@/pages/agentWorkspace");
              return { Component: AgentWorkspace };
            },
          },
          {
            path: "agent-profile",
            async lazy() {
              const { AgentProfile } = await import("@/pages/agentProfile");
              return { Component: AgentProfile };
            },
          },
          {
            path: "task-list",
            async lazy() {
              const { TaskList } = await import("@/pages/taskList");
              return { Component: TaskList };
            },
          },
        ],
      },
      {
        path: "login",
        async lazy() {
          const { Login } = await import("@/pages/login");
          return { Component: Login };
        },
      },
    ],
  },
  {
    path: "third",
    children: [...thirdRoutes],
  },
  {
    path: "oauth",
    children: [
      {
        path: "callback",
        async lazy() {
          const { OAuthCallback } = await import("@/pages/oauth");
          return { Component: OAuthCallback };
        },
      },
    ],
  },
]);

export default router;
