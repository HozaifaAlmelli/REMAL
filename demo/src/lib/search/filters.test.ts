import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchParams,
  EMPTY_SEARCH_FILTERS,
  parseSearchFilters,
  toCatalogParams,
} from "./filters";

test("restores displayed filters from a deep link and ignores invalid values", () => {
  const filters = parseSearchFilters(
    new URLSearchParams("projectId=project-1&minGuests=4")
  );

  assert.deepEqual(filters, {
    projectId: "project-1",
    minGuests: "4",
  });
  assert.deepEqual(
    parseSearchFilters(new URLSearchParams("minGuests=-2&unitType=castle")),
    EMPTY_SEARCH_FILTERS
  );
});

test("builds a canonical URL and API request for project and guests", () => {
  const filters = {
    ...EMPTY_SEARCH_FILTERS,
    projectId: "project-1",
    minGuests: "4",
  };

  assert.equal(
    buildSearchParams(filters).toString(),
    "projectId=project-1&minGuests=4"
  );
  assert.deepEqual(toCatalogParams(filters), {
    page: 1,
    pageSize: 100,
    projectId: "project-1",
    minGuests: 4,
  });
});
