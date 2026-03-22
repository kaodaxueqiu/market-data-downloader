import { Avatar as AntdAvatar, AvatarProps } from "antd";
import clsx from "clsx";
import * as React from "react";
import { useMemo } from "react";

import default_group from "@/assets/images/contact/my_groups.png";
import organization_icon from "@/assets/images/contact/organization_icon.png";

const AVATAR_CACHE_BUSTER = Date.now();

interface IOIMAvatarProps extends AvatarProps {
  text?: string;
  color?: string;
  bgColor?: string;
  isgroup?: boolean;
  isnotification?: boolean;
  isdepartment?: boolean;
  size?: number;
}

const OIMAvatar: React.FC<IOIMAvatarProps> = (props) => {
  const {
    src,
    text,
    size = 42,
    color = "#fff",
    bgColor = "#0289FA",
    isgroup = false,
    isnotification,
    isdepartment,
  } = props;
  const [errorHolder, setErrorHolder] = React.useState<string>();

  const getAvatarUrl = useMemo(() => {
    if (src) {
      const sep = (src as string).includes("?") ? "&" : "?";
      return `${src}${sep}_v=${AVATAR_CACHE_BUSTER}`;
    }
    if (isdepartment) return organization_icon;
    return isgroup ? default_group : undefined;
  }, [src, isgroup, isnotification]);

  const avatarProps = {
    ...props,
    isgroup: undefined,
    isnotification: undefined,
    isdepartment: undefined,
  };

  React.useEffect(() => {
    setErrorHolder(undefined);
  }, [src, isgroup, isdepartment]);

  const errorHandler = (): boolean => {
    if (isdepartment) {
      setErrorHolder(organization_icon);
      return false;
    }
    if (isgroup) {
      setErrorHolder(default_group);
      return false;
    }
    return true;
  };

  return (
    <AntdAvatar
      style={{
        backgroundColor: bgColor,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        lineHeight: `${size - 2}px`,
        color,
      }}
      shape="square"
      {...avatarProps}
      className={clsx(
        {
          "cursor-pointer": Boolean(props.onClick),
        },
        props.className,
      )}
      src={errorHolder ?? getAvatarUrl}
      onError={errorHandler}
    >
      {text}
    </AntdAvatar>
  );
};

export default OIMAvatar;
