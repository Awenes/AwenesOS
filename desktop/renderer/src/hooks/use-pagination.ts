import { useEffect, useState } from "react";
import { paginate } from "../../../../src/domain/pagination.js";

export function usePagination<T>(items: T[], resetKey = "", pageSize = 8) {
  const [page, setPage] = useState(1);
  const slice = paginate(items, page, pageSize);

  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => setPage(slice.page), [slice.page]);

  return { ...slice, setPage };
}
