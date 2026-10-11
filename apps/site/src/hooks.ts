import React from "react";

export function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : globalThis.innerWidth
  );

  React.useEffect(() => {
    const onResize = () => setWidth(globalThis.innerWidth);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  return width;
}
