import { useEffect } from "react";

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title
      ? `${title} · Farm Workforce`
      : "Farm Workforce — farm jobs and workers across Nigeria";
  }, [title]);
}
