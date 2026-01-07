import { useEffect, useState } from "react";

export function navigate(to) {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathname() {
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname
  );

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return path;
}

export function AppLink({ to, onClick, ...props }) {
  const handleClick = event => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
    if (onClick) {
      onClick(event);
    }
  };

  return <a href={to} onClick={handleClick} {...props} />;
}
