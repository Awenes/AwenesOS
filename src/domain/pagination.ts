export interface PageSlice<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], requestedPage: number, pageSize: number): PageSlice<T> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Page size must be a positive integer");
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(1, Math.min(Math.trunc(requestedPage) || 1, totalPages));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages,
  };
}
