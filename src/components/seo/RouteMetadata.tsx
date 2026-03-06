import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type AuthState = "loading" | "anonymous" | "authenticated";

type RouteMeta = {
  title: string;
  description: string;
  robots: string;
};

const defaultDescription =
  "Orbit is a dark-themed productivity workspace for tasks, notes, and AI-assisted focus.";

const privateRouteMetadata: Record<string, Omit<RouteMeta, "robots">> = {
  "/": {
    title: "Dashboard | Orbit",
    description:
      "Review priorities, deadlines, and progress from your Orbit dashboard.",
  },
  "/notes": {
    title: "Notes | Orbit",
    description:
      "Capture, organize, and revisit notes inside your Orbit workspace.",
  },
  "/luna": {
    title: "Luna | Orbit",
    description:
      "Work with Luna, the built-in Orbit assistant for planning and focus.",
  },
  "/archive": {
    title: "Archive | Orbit",
    description: "Browse completed work and archived history in Orbit.",
  },
};

function resolveRouteMeta(pathname: string, authState: AuthState): RouteMeta {
  if (authState === "authenticated") {
    const page = privateRouteMetadata[pathname] ?? privateRouteMetadata["/"];

    return {
      ...page,
      robots: "noindex, nofollow",
    };
  }

  if (authState === "loading") {
    return {
      title: "Orbit",
      description: defaultDescription,
      robots:
        "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    };
  }

  return {
    title: "Orbit | Personal Task Universe",
    description:
      "Orbit brings tasks, notes, and AI-assisted focus into one installable dark-themed workspace.",
    robots:
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  };
}

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]`,
  );

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function toAbsoluteUrl(pathname: string) {
  const baseUrl =
    typeof window === "undefined" ? __ORBIT_SITE_URL__ : window.location.origin;

  return new URL(pathname, baseUrl).toString();
}

interface RouteMetadataProps {
  authState: AuthState;
}

export function RouteMetadata({ authState }: RouteMetadataProps) {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname || "/";
    const metadata = resolveRouteMeta(pathname, authState);
    const canonicalUrl = toAbsoluteUrl(pathname);
    const imageUrl = toAbsoluteUrl("/icons/icon-512.png");

    document.title = metadata.title;

    upsertMeta("name", "description", metadata.description);
    upsertMeta("name", "robots", metadata.robots);
    upsertMeta("name", "theme-color", "#070810");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Orbit");
    upsertMeta("property", "og:title", metadata.title);
    upsertMeta("property", "og:description", metadata.description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("property", "og:image:alt", "Orbit app icon");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", metadata.title);
    upsertMeta("name", "twitter:description", metadata.description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertLink("canonical", canonicalUrl);
  }, [authState, location.pathname]);

  return null;
}
