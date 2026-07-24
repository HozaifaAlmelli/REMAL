import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import type {
  CrmAssigneeResponse,
  CrmLeadListItemResponse,
  CrmLeadStatus,
} from "../../lib/types/crm.types";

const API_ORIGIN = "http://crm-fixture.local";
const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const SECOND_ADMIN_ID = "10000000-0000-4000-8000-000000000002";
const runtimeIssues = new WeakMap<Page, string[]>();

const assignees: CrmAssigneeResponse[] = [
  {
    id: ADMIN_ID,
    name: "Sanitized Sales One",
    email: "sales.one@example.test",
    roleName: "Sales",
  },
  {
    id: SECOND_ADMIN_ID,
    name: "Sanitized Sales Two",
    email: "sales.two@example.test",
    roleName: "Sales",
  },
];

const stageDistribution: Array<[CrmLeadStatus, number]> = [
  ["Prospecting", 40],
  ["Relevant", 20],
  ["NoAnswer", 12],
  ["Booked", 0],
  ["NotRelevant", 8],
];

function createSanitizedLeads(): CrmLeadListItemResponse[] {
  let index = 0;

  return stageDistribution.flatMap(([leadStatus, count]) =>
    Array.from({ length: count }, () => {
      index += 1;
      const suffix = String(index).padStart(3, "0");
      const hasOptionalFields = index % 5 !== 0;

      return {
        id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        clientId: null,
        targetUnitId: hasOptionalFields
          ? `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`
          : null,
        assignedAdminUserId:
          index % 3 === 0 ? null : index % 2 === 0 ? ADMIN_ID : SECOND_ADMIN_ID,
        contactName:
          index === 1
            ? "Sanitized Lead With An Intentionally Long Contact Name"
            : `Sanitized Lead ${suffix}`,
        contactPhone: `+2010000${String(index).padStart(5, "0")}`,
        contactEmail: hasOptionalFields ? `lead.${suffix}@example.test` : null,
        leadStatus,
        source: ["website", "whatsapp", "phone", "admin"][index % 4]!,
        desiredCheckInDate: hasOptionalFields ? "2026-09-10" : null,
        desiredCheckOutDate: hasOptionalFields ? "2026-09-14" : null,
        guestCount: hasOptionalFields ? (index % 6) + 1 : null,
        targetUnitName: hasOptionalFields
          ? `Sanitized Unit ${String((index % 8) + 1).padStart(2, "0")}`
          : null,
        createdAt: new Date(
          Date.UTC(2026, 6, 20, 12, 0, 0) - index * 60_000
        ).toISOString(),
      };
    })
  );
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "http://localhost:3102",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "content-type": "application/json",
  };
}

async function fulfillEnvelope(
  route: Route,
  data: unknown,
  options?: {
    status?: number;
    pagination?: {
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }
) {
  await route.fulfill({
    status: options?.status ?? 200,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: (options?.status ?? 200) < 400,
      data,
      pagination: options?.pagination,
      message: (options?.status ?? 200) < 400 ? null : "Fixture failure",
      errors: [],
    }),
  });
}

interface FixtureApi {
  leads: CrmLeadListItemResponse[];
  leadListRequests: number;
  statusUpdates: Array<{ leadId: string; status: CrmLeadStatus }>;
  failNextStatusUpdate: boolean;
}

async function installFixtureApi(page: Page): Promise<FixtureApi> {
  const state: FixtureApi = {
    leads: createSanitizedLeads(),
    leadListRequests: 0,
    statusUpdates: [],
    failNextStatusUpdate: false,
  };

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      await fulfillEnvelope(route, {
        accessToken: "sanitized-local-access-token",
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "SuperAdmin",
        roleName: "Super Admin",
        user: {
          userId: ADMIN_ID,
          identifier: "qa.admin@example.test",
          subjectType: "Admin",
          adminRole: "SuperAdmin",
          name: "Sanitized QA Admin",
        },
        permissions: ["crm:read", "crm:write", "crm:assign"],
      });
      return;
    }

    if (url.pathname === "/api/internal/me/notifications/inbox/summary") {
      await fulfillEnvelope(route, {
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
      return;
    }

    if (url.pathname === "/api/internal/crm/assignees") {
      await fulfillEnvelope(route, assignees);
      return;
    }

    if (url.pathname === "/api/internal/admin-directory") {
      await fulfillEnvelope(route, assignees);
      return;
    }

    if (url.pathname === "/api/internal/crm/leads/open-count") {
      const openStatuses: CrmLeadStatus[] = [
        "Prospecting",
        "Relevant",
        "NoAnswer",
        "Booked",
      ];
      await fulfillEnvelope(
        route,
        state.leads.filter((lead) => openStatuses.includes(lead.leadStatus))
          .length
      );
      return;
    }

    if (
      url.pathname === "/api/internal/crm/leads" &&
      request.method() === "GET"
    ) {
      state.leadListRequests += 1;
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const requestedPageSize = Number(
        url.searchParams.get("pageSize") ?? "20"
      );
      const pageSize = Math.min(requestedPageSize, 30);
      const start = (pageNumber - 1) * pageSize;
      const items = state.leads.slice(start, start + pageSize);

      await fulfillEnvelope(route, items, {
        pagination: {
          totalCount: state.leads.length,
          page: pageNumber,
          pageSize,
          totalPages: Math.max(1, Math.ceil(state.leads.length / pageSize)),
        },
      });
      return;
    }

    const statusMatch = url.pathname.match(
      /^\/api\/internal\/crm\/leads\/([^/]+)\/status$/
    );
    if (statusMatch && request.method() === "PATCH") {
      const leadId = statusMatch[1]!;
      const payload = request.postDataJSON() as { leadStatus: CrmLeadStatus };

      if (state.failNextStatusUpdate) {
        state.failNextStatusUpdate = false;
        await fulfillEnvelope(route, null, { status: 500 });
        return;
      }

      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) {
        await fulfillEnvelope(route, null, { status: 404 });
        return;
      }

      lead.leadStatus = payload.leadStatus;
      state.statusUpdates.push({ leadId, status: payload.leadStatus });
      await fulfillEnvelope(route, {
        ...lead,
        notes: null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const detailMatch = url.pathname.match(
      /^\/api\/internal\/crm\/leads\/([^/]+)$/
    );
    if (detailMatch && request.method() === "GET") {
      const lead = state.leads.find((item) => item.id === detailMatch[1]);
      await fulfillEnvelope(
        route,
        lead ? { ...lead, notes: null, updatedAt: lead.createdAt } : null,
        { status: lead ? 200 : 404 }
      );
      return;
    }

    if (/\/notes$/.test(url.pathname)) {
      await fulfillEnvelope(route, []);
      return;
    }

    if (/\/assignment$/.test(url.pathname)) {
      await fulfillEnvelope(route, null);
      return;
    }

    await fulfillEnvelope(route, null, { status: 404 });
  });

  return state;
}

async function openCrm(page: Page, path = "/admin/crm") {
  await page.goto(path);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Leads pipeline", level: 1 })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("crm-lead-count")).toHaveText("30 of 80 leads");

  const loadMore = page.getByRole("button", { name: "Load more leads" });
  await loadMore.click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("60 of 80 leads");
  await loadMore.click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("80 leads");
  await expect(loadMore).toBeHidden();
}

async function captureReviewScreenshot(page: Page, name: string) {
  if (process.env.CRM_CAPTURE_SCREENSHOTS !== "1") return;

  const outputDirectory = path.resolve(
    process.cwd(),
    "..",
    "docs",
    "qa",
    "crm-prospecting-scroll-and-views"
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(outputDirectory, `${name}.png`),
    fullPage: false,
  });
}

test.beforeEach(async ({ page }) => {
  const issues: string[] = [];
  runtimeIssues.set(page, issues);
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    issues.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    )
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console: ${message.text()}`);
    }
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.context().addCookies([
    {
      name: "refresh_token",
      value: "sanitized-local-refresh-token",
      url: "http://localhost:3102",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test.afterEach(async ({ page }, testInfo) => {
  const issues = runtimeIssues.get(page) ?? [];
  const unexpectedIssues =
    testInfo.title ===
    "dragging into an empty stage updates only the intended lead and failure keeps state"
      ? issues.filter(
          (issue) =>
            !issue.includes(
              "Failed to load resource: the server responded with a status of 500"
            )
        )
      : issues.filter(
          (issue) =>
            !(
              issue.startsWith("requestfailed:") &&
              issue.includes("_rsc=") &&
              issue.includes("net::ERR_ABORTED")
            )
        );

  expect(unexpectedIssues).toEqual([]);
});

test("renders all loaded cards and independently scrolls a long stage", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);
  expect(fixture.leadListRequests).toBe(3);

  const prospectingColumn = page.locator('[data-stage="Prospecting"]');
  const prospectingList = page.getByTestId("crm-stage-list-Prospecting");
  const prospectingCards = prospectingColumn.locator('[role="listitem"]');
  const board = page.getByTestId("crm-pipeline-board");

  await expect(prospectingCards).toHaveCount(40);
  await expect(
    prospectingColumn.getByText("40", { exact: true })
  ).toBeVisible();
  await captureReviewScreenshot(page, "pipeline-long-stage");

  const initialMetrics = await prospectingList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(initialMetrics.scrollHeight).toBeGreaterThan(
    initialMetrics.clientHeight
  );
  expect(initialMetrics.scrollTop).toBe(0);

  await prospectingList.hover();
  await page.mouse.wheel(0, 480);
  await expect
    .poll(() => prospectingList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  const headerBefore = await prospectingColumn
    .getByRole("heading", { name: "Prospecting" })
    .boundingBox();
  await prospectingList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect(prospectingCards.last()).toBeVisible();
  const finalCardBox = await prospectingCards.last().boundingBox();
  const listBox = await prospectingList.boundingBox();
  expect(finalCardBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(finalCardBox!.y + finalCardBox!.height).toBeLessThanOrEqual(
    listBox!.y + listBox!.height + 1
  );

  const headerAfter = await prospectingColumn
    .getByRole("heading", { name: "Prospecting" })
    .boundingBox();
  expect(headerAfter?.y).toBe(headerBefore?.y);
  await captureReviewScreenshot(page, "pipeline-final-lead");

  const boardMetrics = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(boardMetrics.scrollWidth).toBeGreaterThan(boardMetrics.clientWidth);
  await board.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(page.locator('[data-stage="Booked"]')).toBeVisible();

  await prospectingList.evaluate((element) => {
    element.scrollTop = 420;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByTestId("crm-stage-list-Prospecting")
        .evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(300);

  await page.getByRole("button", { name: /Show closed leads/ }).click();
  await expect(page.locator('[role="listitem"]')).toHaveCount(80);
});

test("switches views, preserves filters, paginates, and restores URL state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);
  const requestCountBeforeViewSwitch = fixture.leadListRequests;

  await page.getByLabel("Search leads").fill("Sanitized Lead");
  await page.getByLabel("Filter by stage").selectOption("Prospecting");
  await expect(page).toHaveURL(/q=Sanitized\+Lead/);
  await expect(page).toHaveURL(/stage=Prospecting/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText("40 of 80 leads");

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page).toHaveURL(/stage=Prospecting/);
  await expect(page.getByText("Showing 1–25 of 40 results")).toBeVisible();
  expect(fixture.leadListRequests).toBe(requestCountBeforeViewSwitch);
  await captureReviewScreenshot(page, "list-filter-preserved");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Showing 26–40 of 40 results")).toBeVisible();

  await page.waitForTimeout(250);
  await page.goBack();
  await expect(page.getByText("Showing 1–25 of 40 results")).toBeVisible();
  await page.waitForTimeout(250);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Pipeline", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Search leads")).toHaveValue("Sanitized Lead");
  await expect(page.getByLabel("Filter by stage")).toHaveValue("Prospecting");
  await page.waitForTimeout(500);

  await page.goto("/admin/crm?view=unsupported");
  await expect(
    page.getByRole("button", { name: "Pipeline", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
});

test("list view exposes every lead through pagination and opens row details", async ({
  page,
}) => {
  await installFixtureApi(page);
  await openCrm(page, "/admin/crm?view=list");

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(25);
  await expect(page.getByText("Showing 1–25 of 80 results")).toBeVisible();
  await captureReviewScreenshot(page, "list-view");

  await page.getByLabel("Filter by source").selectOption("phone");
  await expect(page).toHaveURL(/source=phone/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText("20 of 80 leads");
  await page.getByLabel("Filter by assigned owner").selectOption("unassigned");
  await expect(page).toHaveURL(/owner=unassigned/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText(
    /\d+ of 80 leads/
  );
  await page.getByRole("button", { name: "Clear CRM filters" }).click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("80 leads");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 26–50 of 80 results")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 51–75 of 80 results")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 76–80 of 80 results")).toBeVisible();
  await expect(rows).toHaveCount(5);

  const finalLead = rows.last();
  await finalLead.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/crm\/leads\/20000000-/);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Sanitized Lead 080", level: 1 })
  ).toBeVisible();
});

test("dragging into an empty stage updates only the intended lead and failure keeps state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);

  const relevantColumn = page.locator('[data-stage="Relevant"]');
  const relevantList = page.getByTestId("crm-stage-list-Relevant");
  const bookedColumn = page.locator('[data-stage="Booked"]');
  const bookedList = page.getByTestId("crm-stage-list-Booked");
  const sourceCard = relevantColumn
    .locator('[role="listitem"] [role="button"]')
    .first();

  await bookedColumn.scrollIntoViewIfNeeded();
  await sourceCard.scrollIntoViewIfNeeded();

  await relevantList.evaluate((element) => {
    element.scrollTop = 0;
    const column = element.closest('[data-stage="Relevant"]');
    const bounds = element.getBoundingClientRect();
    column?.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientY: bounds.bottom - 2,
        dataTransfer: new DataTransfer(),
      })
    );
  });
  await expect
    .poll(() => relevantList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await sourceCard.dragTo(bookedList);
  await expect(bookedColumn.locator('[role="listitem"]')).toHaveCount(1);
  await expect(relevantColumn.locator('[role="listitem"]')).toHaveCount(19);
  expect(fixture.statusUpdates).toHaveLength(1);
  expect(new Set(fixture.leads.map((lead) => lead.id)).size).toBe(80);

  fixture.failNextStatusUpdate = true;
  const secondSourceCard = relevantColumn
    .locator('[role="listitem"] [role="button"]')
    .first();
  await secondSourceCard.dragTo(bookedList);
  await expect(page.getByText("Cannot move lead to this stage")).toBeVisible();
  await expect(bookedColumn.locator('[role="listitem"]')).toHaveCount(1);
  await expect(relevantColumn.locator('[role="listitem"]')).toHaveCount(19);
  expect(fixture.statusUpdates).toHaveLength(1);
  expect(new Set(fixture.leads.map((lead) => lead.id)).size).toBe(80);
});

test("remains usable at tablet and mobile widths", async ({ page }) => {
  await installFixtureApi(page);
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openCrm(page);

    await expect(
      page.getByRole("button", { name: "Pipeline", exact: true })
    ).toBeVisible();
    const prospectingList = page.getByTestId("crm-stage-list-Prospecting");
    expect(
      await prospectingList.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(25);
    const tableScroller = page.locator("table").locator("..");
    expect(
      await tableScroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth
      )
    ).toBe(true);
    await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  }
});

test("keeps long stages reachable at supported desktop viewports", async ({
  page,
}) => {
  await installFixtureApi(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await openCrm(page);
    const list = page.getByTestId("crm-stage-list-Prospecting");
    const cards = page
      .locator('[data-stage="Prospecting"]')
      .locator('[role="listitem"]');

    await expect(cards).toHaveCount(40);
    expect(
      await list.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    await list.focus();
    await page.keyboard.press("End");
    await expect(cards.last()).toBeVisible();
  }
});
