import { MAX_PAGE_LIMIT, parseLimit, parsePage } from '../utils/pagination.js';

/**
 * Caps ?limit and ?pageSize on all API requests before route handlers run.
 * Handlers should still use parsePagination() for consistent defaults.
 */
export default function paginationCap(req, _res, next) {
  if (req.query?.limit != null) {
    req.query.limit = String(parseLimit(req.query.limit, MAX_PAGE_LIMIT));
  }
  if (req.query?.pageSize != null) {
    req.query.pageSize = String(parseLimit(req.query.pageSize, MAX_PAGE_LIMIT));
  }
  if (req.query?.page != null) {
    req.query.page = String(parsePage(req.query.page, 1));
  }
  next();
}
