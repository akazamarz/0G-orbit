import Image from "next/image";
import styles from "./index.module.css";

const WIDTH = 570;
const HEIGHT = 488;

const SIZE_PX = { sm: 32, md: 40, lg: 44 } as const;

interface Props {
  size?: keyof typeof SIZE_PX;
  className?: string;
}

export function OrbitLogo({ size = "md", className }: Props) {
  const height = SIZE_PX[size];
  return (
    <Image
      src="/images/orbit-logo.png"
      alt=""
      width={WIDTH}
      height={HEIGHT}
      className={[styles.logo, className].filter(Boolean).join(" ")}
      style={{ height, width: "auto" }}
      priority={size === "lg"}
    />
  );
}
