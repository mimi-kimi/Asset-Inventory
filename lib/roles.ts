import type { Role } from "@/lib/types";

/** What each role can do — used by the user manager and the role picker. */
export const ROLE_META: Record<Role, { label: string; hint: string }> = {
  ADMIN: {
    label: "Admin",
    hint: "Lands on the dashboard: map, tasks & import, inspections, catalog, users.",
  },
  INSPECTOR: {
    label: "Inspector",
    hint: "Lands on the mobile app and records inspections; dashboard is read-only.",
  },
};

/** Order the picker/list shows roles in (most powerful first). */
export const ROLE_ORDER: Role[] = ["ADMIN", "INSPECTOR"];

export function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "INSPECTOR";
}

/** Active admins are the ones who can actually sign in and administer the app. */
export function countActiveAdmins<T extends { role: string; active: boolean }>(
  rows: T[],
): number {
  return rows.filter((row) => row.role === "ADMIN" && row.active).length;
}

export interface RoleChangeCheck {
  /** id of the admin performing the change */
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  /** can the target currently sign in? (demoting an inactive admin is always safe) */
  targetActive: boolean;
  /** role the target should get */
  next: Role;
  /** how many admins can currently sign in */
  activeAdmins: number;
}

/**
 * Why this role change is not allowed (null = allowed). Shared by the server
 * action (the real gate) and the UI (so a blocked button says why).
 * Rules: admins only · never your own role · at least one active admin stays.
 */
export function roleChangeError(input: RoleChangeCheck): string | null {
  if (input.actorRole !== "ADMIN") {
    return "Only administrators can change roles.";
  }
  if (input.actorId === input.targetId) {
    return "You cannot change your own role.";
  }
  if (input.targetRole === input.next) {
    return "This user already has that role.";
  }
  if (
    input.targetRole === "ADMIN" &&
    input.targetActive &&
    input.next !== "ADMIN" &&
    input.activeAdmins <= 1
  ) {
    return "At least one admin must stay — promote someone else first.";
  }
  return null;
}


/**
 * Downloading data — a task's CSV or the report history — is an admin tool:
 * inspectors record on the phone and export is done from the dashboard.
 */
export function canExportData(role: Role | null | undefined): boolean {
  return role === "ADMIN";
}

/**
 * A report belongs to the person who recorded it: only they — or an admin — may
 * change it. Everyone else reads it and can add a report of their own (mirrors
 * the "update inspections" policy in migration_v10).
 */
export function canEditInspection(input: {
  inspectorId: string;
  meId: string;
  isAdmin: boolean;
}): boolean {
  return input.isAdmin || input.inspectorId === input.meId;
}
