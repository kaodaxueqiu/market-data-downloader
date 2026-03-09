import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import AntdGlobalComp from "./AntdGlobalComp";
import router from "./routes";
import { useUserStore } from "./store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const locale = useUserStore((state) => state.appSettings.locale);

  useEffect(() => {
    // document.documentElement.classList.add("dark")
  }, []);

  return (
    <ConfigProvider
      autoInsertSpaceInButton={false}
      locale={locale === "zh-CN" ? zhCN : enUS}
      theme={{
        // algorithm: [theme.darkAlgorithm],
        token: { colorPrimary: "#0089FF" },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>loading...</div>}>
          <AntdApp>
            <AntdGlobalComp />
            <RouterProvider router={router} />
          </AntdApp>
        </Suspense>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

export default App;
