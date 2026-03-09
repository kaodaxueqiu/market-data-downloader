import { t } from "i18next";
import { FC } from "react";

import { WorkMoments } from "@/types/moment";

import { RouteTravel } from "..";

type ItemProps = {
  moment: WorkMoments;
  time: string;
  updateRouteTravel: (data: RouteTravel) => void;
};

const Item: FC<ItemProps> = ({ moment, time, updateRouteTravel }) => {
  const hasMetas = (moment: WorkMoments) => Boolean(moment.content.metas?.length);
  const cover = (moment: WorkMoments) =>
    moment.content.metas && moment.content?.metas[0].thumb;

  return (
    <div
      className="flex cursor-pointer items-start"
      onClick={() => updateRouteTravel({ moments: moment })}
    >
      <div className="mt-2 flex w-full justify-center">
        <span className="ml-2 flex w-15 items-start justify-center font-semibold">
          {time}
        </span>
        {hasMetas(moment) && (
          <div className="mb-2 flex flex-1 flex-row px-3">
            <img className="h-17.5 w-17.5 object-cover" src={cover(moment)} />
            <div className="ml-2 flex h-17.5 flex-1 flex-col items-start justify-between">
              <span className="line-clamp-2 w-full overflow-hidden break-all">
                {moment.content.text}
              </span>
              <span className="text-xs text-[#8E9AB0]">
                {t("contact.text.totalNumPhoto", { num: moment.content.metas?.length })}
              </span>
            </div>
          </div>
        )}
        {!hasMetas(moment) && (
          <div className="mb-2 flex flex-1 flex-row overflow-hidden px-3">
            <div className="w-full bg-[rgba(232,234,239,0.8)] px-2 py-1">
              <span className="line-clamp-2 w-full overflow-hidden break-all">
                {moment.content.text}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Item;
