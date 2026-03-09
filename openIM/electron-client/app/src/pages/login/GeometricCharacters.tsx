import { useEffect, useRef, useState } from "react";

interface GeometricCharactersProps {
  isPasswordFocused?: boolean;
}

const GeometricCharacters = ({ isPasswordFocused }: GeometricCharactersProps) => {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const eyeOffset = {
    x: (mousePos.x - 0.5) * 3,
    y: (mousePos.y - 0.5) * 2,
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 0,
        height: 300,
        position: "relative",
        transform: "scale(1.4)",
        transformOrigin: "bottom center",
      }}
    >
      {/* Orange semicircle */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: 120,
            height: 60,
            backgroundColor: "#F47B20",
            borderRadius: "120px 120px 0 0",
            position: "relative",
            transition: "transform 0.3s",
            transform: isPasswordFocused ? "translateY(4px)" : "translateY(0)",
          }}
        >
          <Eye
            x={35}
            y={25}
            size={6}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#2D2D2D"
          />
          <Eye
            x={65}
            y={25}
            size={6}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#2D2D2D"
          />
          <div
            style={{
              position: "absolute",
              left: 42,
              top: 40,
              width: 16,
              height: isPasswordFocused ? 2 : 8,
              borderRadius: isPasswordFocused ? 1 : "0 0 8px 8px",
              backgroundColor: isPasswordFocused ? "#2D2D2D" : "transparent",
              borderBottom: isPasswordFocused ? "none" : "2px solid #2D2D2D",
              transition: "all 0.3s",
            }}
          />
        </div>
      </div>

      {/* Purple rectangle */}
      <div style={{ position: "relative", zIndex: 2, marginLeft: -10 }}>
        <div
          style={{
            width: 56,
            height: 140,
            backgroundColor: "#6B4DE6",
            borderRadius: "12px 12px 0 0",
            position: "relative",
            transition: "transform 0.3s",
            transform: isPasswordFocused ? "translateY(2px)" : "translateY(0)",
          }}
        >
          <Eye
            x={14}
            y={50}
            size={5}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#FFF"
          />
          <Eye
            x={34}
            y={50}
            size={5}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#FFF"
          />
        </div>
      </div>

      {/* Black small rectangle */}
      <div style={{ position: "relative", zIndex: 3, marginLeft: -6 }}>
        <div
          style={{
            width: 36,
            height: 70,
            backgroundColor: "#2D2D2D",
            borderRadius: "8px 8px 0 0",
            position: "relative",
            transition: "transform 0.3s",
            transform: isPasswordFocused ? "translateY(3px)" : "translateY(0)",
          }}
        >
          <Eye
            x={8}
            y={28}
            size={4}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#FFF"
          />
          <Eye
            x={22}
            y={28}
            size={4}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#FFF"
          />
        </div>
      </div>

      {/* Yellow blob */}
      <div style={{ position: "relative", zIndex: 2, marginLeft: -4 }}>
        <div
          style={{
            width: 64,
            height: 52,
            backgroundColor: "#F5C542",
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            position: "relative",
            transition: "transform 0.3s",
            transform: isPasswordFocused ? "translateY(3px)" : "translateY(0)",
          }}
        >
          <Eye
            x={16}
            y={16}
            size={5}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#2D2D2D"
          />
          <Eye
            x={36}
            y={16}
            size={5}
            offset={eyeOffset}
            closed={isPasswordFocused}
            color="#2D2D2D"
          />
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 32,
              width: 14,
              height: 2,
              backgroundColor: "#2D2D2D",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Eye = ({
  x,
  y,
  size,
  offset,
  closed,
  color,
}: {
  x: number;
  y: number;
  size: number;
  offset: { x: number; y: number };
  closed?: boolean;
  color: string;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size * 2,
      height: closed ? 2 : size * 2,
      backgroundColor: color,
      borderRadius: closed ? 1 : "50%",
      transition: "all 0.3s",
      transform: closed
        ? "none"
        : `translate(${offset.x}px, ${offset.y}px)`,
    }}
  />
);

export default GeometricCharacters;
