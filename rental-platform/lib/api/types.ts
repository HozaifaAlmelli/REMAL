export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors: string[] | null;
  code?: string | null;
  metadata?: Record<string, unknown> | null;
  pagination: PaginationMeta | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
