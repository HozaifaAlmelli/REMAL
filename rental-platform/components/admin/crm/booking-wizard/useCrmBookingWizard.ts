"use client";

import { useEffect, useReducer, useState } from "react";
import type { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import type { UnitType } from "@/lib/types/unit.types";
import {
  getInitialWizardStep,
  type CrmBookingWizardLocale,
  type CrmBookingWizardStepId,
} from "./crm-booking-wizard";

export interface WizardClientDraft {
  name: string;
  phone: string;
  email: string;
}

export interface WizardClientSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface CrmBookingWizardState {
  currentStep: CrmBookingWizardStepId;
  selectedUnitId: string | null;
  clientId: string | null;
  client: WizardClientSummary | null;
  clientDraft: WizardClientDraft;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  internalNotes: string;
  unitTypeFilter: "" | UnitType;
  conflictMessage: string | null;
  clientError: string | null;
  submissionError: string | null;
  temporaryPassword: string | null;
}

type WizardAction =
  | { type: "reset"; lead: CrmLeadDetailsResponse }
  | { type: "goTo"; step: CrmBookingWizardStepId }
  | { type: "selectUnit"; unitId: string | null }
  | { type: "setUnitType"; unitType: "" | UnitType }
  | {
      type: "setStay";
      checkInDate: string;
      checkOutDate: string;
      clearSelectedUnit: boolean;
    }
  | { type: "setGuestCount"; guestCount: number }
  | { type: "setInternalNotes"; internalNotes: string }
  | { type: "setClientDraft"; draft: Partial<WizardClientDraft> }
  | {
      type: "attachClient";
      client: WizardClientSummary;
      temporaryPassword?: string | null;
    }
  | { type: "clearClient"; lead: CrmLeadDetailsResponse }
  | { type: "setClientError"; message: string | null }
  | { type: "setSubmissionError"; message: string | null }
  | { type: "availabilityConflict"; message: string };

function createInitialState(
  lead: CrmLeadDetailsResponse
): CrmBookingWizardState {
  return {
    currentStep: getInitialWizardStep(lead),
    selectedUnitId: lead.targetUnitId,
    clientId: lead.clientId,
    client: lead.clientId
      ? {
          id: lead.clientId,
          name: lead.contactName,
          phone: lead.contactPhone,
          email: lead.contactEmail,
        }
      : null,
    clientDraft: {
      name: lead.contactName ?? "",
      phone: lead.contactPhone ?? "",
      email: lead.contactEmail ?? "",
    },
    checkInDate: lead.desiredCheckInDate ?? "",
    checkOutDate: lead.desiredCheckOutDate ?? "",
    guestCount: Math.max(1, lead.guestCount ?? 1),
    internalNotes: "",
    unitTypeFilter: "",
    conflictMessage: null,
    clientError: null,
    submissionError: null,
    temporaryPassword: null,
  };
}

function reducer(
  state: CrmBookingWizardState,
  action: WizardAction
): CrmBookingWizardState {
  switch (action.type) {
    case "reset":
      return createInitialState(action.lead);
    case "goTo":
      return {
        ...state,
        currentStep: action.step,
        clientError: null,
        submissionError: null,
      };
    case "selectUnit":
      return {
        ...state,
        selectedUnitId: action.unitId,
        conflictMessage: null,
        submissionError: null,
      };
    case "setUnitType":
      return {
        ...state,
        unitTypeFilter: action.unitType,
        selectedUnitId: null,
        conflictMessage: null,
      };
    case "setStay":
      return {
        ...state,
        checkInDate: action.checkInDate,
        checkOutDate: action.checkOutDate,
        selectedUnitId: action.clearSelectedUnit
          ? null
          : state.selectedUnitId,
        conflictMessage: null,
      };
    case "setGuestCount":
      return { ...state, guestCount: action.guestCount };
    case "setInternalNotes":
      return { ...state, internalNotes: action.internalNotes };
    case "setClientDraft":
      return {
        ...state,
        clientDraft: { ...state.clientDraft, ...action.draft },
        clientError: null,
      };
    case "attachClient":
      return {
        ...state,
        clientId: action.client.id,
        client: action.client,
        clientError: null,
        temporaryPassword:
          action.temporaryPassword ?? state.temporaryPassword,
      };
    case "clearClient":
      return {
        ...state,
        clientId: null,
        client: null,
        clientDraft: {
          name: action.lead.contactName ?? "",
          phone: action.lead.contactPhone ?? "",
          email: action.lead.contactEmail ?? "",
        },
        clientError: null,
        temporaryPassword: null,
      };
    case "setClientError":
      return { ...state, clientError: action.message };
    case "setSubmissionError":
      return { ...state, submissionError: action.message };
    case "availabilityConflict":
      return {
        ...state,
        currentStep: "unit",
        selectedUnitId: null,
        conflictMessage: action.message,
        submissionError: null,
      };
  }
}

export function useCrmBookingWizard(lead: CrmLeadDetailsResponse) {
  const [state, dispatch] = useReducer(reducer, lead, createInitialState);

  useEffect(() => {
    dispatch({ type: "reset", lead });
    // A route change is the reset boundary. Query refreshes for the same lead
    // must not discard in-progress wizard input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  return { state, dispatch };
}

function getDocumentLocale(): CrmBookingWizardLocale {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang.toLowerCase().startsWith("ar") ||
    document.documentElement.dir === "rtl"
    ? "ar"
    : "en";
}

export function useCrmBookingWizardLocale(): CrmBookingWizardLocale {
  const [locale, setLocale] = useState<CrmBookingWizardLocale>("en");

  useEffect(() => {
    const root = document.documentElement;
    const updateLocale = () => setLocale(getDocumentLocale());
    updateLocale();

    const observer = new MutationObserver(updateLocale);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["lang", "dir"],
    });
    return () => observer.disconnect();
  }, []);

  return locale;
}
