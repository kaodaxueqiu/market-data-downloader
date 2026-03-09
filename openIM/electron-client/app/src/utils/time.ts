import { t } from "i18next";

export const secondsToTime = (seconds: number) => {
  let minutes = 0; // min
  let hours = 0; // hour
  let days = 0; // day
  if (seconds > 60) {
    minutes = parseInt((seconds / 60) as unknown as string);
    seconds = parseInt((seconds % 60) as unknown as string);
    if (minutes > 60) {
      hours = parseInt((minutes / 60) as unknown as string);
      minutes = parseInt((minutes % 60) as unknown as string);
      if (hours > 24) {
        days = parseInt((hours / 24) as unknown as string);
        hours = parseInt((hours % 24) as unknown as string);
      }
    }
  }
  let result = "";
  if (seconds > 0) {
    result = t("common.dateTime.relative.second", {
      num: parseInt(seconds as unknown as string),
    });
  }
  if (minutes > 0) {
    result =
      t("common.dateTime.relative.minute", {
        num: parseInt(minutes as unknown as string),
      }) + result;
  }
  if (hours > 0) {
    result =
      t("common.dateTime.relative.hour", {
        num: parseInt(hours as unknown as string),
      }) + result;
  }
  if (days > 0) {
    result =
      t("common.dateTime.relative.day", { num: parseInt(days as unknown as string) }) +
      result;
  }
  return result;
};
