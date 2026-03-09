import { FC } from "react";
import { useTranslation } from "react-i18next";

import styles from "./message-item.module.scss";

const CatchMessageRender: FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.bubble}>{t("chat.message.description.catchMessage")}</div>
  );
};

export default CatchMessageRender;
