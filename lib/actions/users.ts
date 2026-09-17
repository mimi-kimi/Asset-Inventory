"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/auth-username";
import { describeError } from "@/lib/format";
import { isRole, roleChangeError } from "@/lib/roles";
import type { Role } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You are not signed in.");
  if (viewer.profile.role !== "ADMIN") {
    throw new Error("Only administrators can manage users.");
  }
  return viewer;
}

/** How many admins can currently sign in (the last one may never be demoted). */
async function activeAdminCount(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "ADMIN")
    .eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function createUser(input: {
  username: string;
  fullName: string;
  password: string;
  mustChange: boolean;
  /** omitted/unknown → INSPECTOR, so an accidental value can never grant rights */
  role?: Role;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const username = normalizeUsername(input.username);
    const role: Role = isRole(input.role) ? input.role : "INSPECTOR";

    if (!isValidUsername(username)) {
      return {
        ok: false,
        error:
          "Username must be 3–32 characters: letters, numbers, dot, dash or underscore.",
      };
    }
    if (input.password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: `Username "${username}" is already taken.` };
    }

    const email = usernameToEmail(username);
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName.trim() || null,
          username,
        },
      });
    if (createError) throw createError;

    const userId = created.user?.id;
    if (userId) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          username,
          email,
          full_name: input.fullName.trim() || null,
          role,
          active: true,
          must_change_password: input.mustChange,
        })
        .eq("id", userId);
      if (profileError) throw profileError;
    }

    revalidatePath("/dashboard/users");
    return {
      ok: true,
      message:
        role === "ADMIN"
          ? `Admin "${username}" created — they land on the dashboard.`
          : `Inspector "${username}" created.`,
    };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not create the user.") };
  }
}

/** Promote an inspector to admin, or send an admin back to inspector. */
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    if (!isRole(role)) {
      return { ok: false, error: "Unknown role." };
    }

    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, username, role, active")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return { ok: false, error: "That user no longer exists." };

    const reason = roleChangeError({
      actorId: viewer.user.id,
      actorRole: viewer.profile.role,
      targetId: userId,
      targetRole: isRole(target.role) ? target.role : "INSPECTOR",
      targetActive: Boolean(target.active),
      next: role,
      activeAdmins: await activeAdminCount(admin),
    });
    if (reason) return { ok: false, error: reason };

    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) throw error;

    revalidatePath("/dashboard/users");
    const who = target.username ?? "User";
    return {
      ok: true,
      message:
        role === "ADMIN"
          ? `${who} is now an admin — they land on the dashboard.`
          : `${who} is now an inspector.`,
    };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not change the role.") };
  }
}

export async function resetUserPassword(
  userId: string,
  password: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);
    revalidatePath("/dashboard/users");
    return { ok: true, message: "Temporary password set." };
  } catch (err) {
    return {
      ok: false,
      error: describeError(err, "Could not reset the password."),
    };
  }
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    /* deactivating the only admin would leave nobody able to administer the app */
    if (!active) {
      const { data: target } = await admin
        .from("profiles")
        .select("role, active")
        .eq("id", userId)
        .maybeSingle();
      if (target?.role === "ADMIN" && target.active) {
        const admins = await activeAdminCount(admin);
        if (admins <= 1) {
          return {
            ok: false,
            error:
              "This is the only active admin — promote another admin before deactivating.",
          };
        }
      }
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (authError) throw authError;
    const { error } = await admin
      .from("profiles")
      .update({ active })
      .eq("id", userId);
    if (error) throw error;
    revalidatePath("/dashboard/users");
    return {
      ok: true,
      message: active
        ? "User reactivated."
        : "User deactivated (cannot sign in).",
    };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not update the user.") };
  }
}

export async function deleteUserById(userId: string): Promise<ActionResult> {
  try {
    const viewer = await requireAdmin();
    if (viewer.user.id === userId) {
      return { ok: false, error: "You cannot delete your own account." };
    }
    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("inspector_id", userId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `This user has ${count} inspection record(s). Deactivate them instead of deleting.`,
      };
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    revalidatePath("/dashboard/users");
    return { ok: true, message: "User deleted." };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not delete the user.") };
  }
}

export async function updateUserProfile(input: {
  userId: string;
  fullName: string;
  username: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const username = normalizeUsername(input.username);
    if (!isValidUsername(username)) {
      return { ok: false, error: "Invalid username." };
    }
    const admin = createAdminClient();
    const { data: clash } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", input.userId)
      .maybeSingle();
    if (clash) {
      return { ok: false, error: `Username "${username}" is already taken.` };
    }

    const email = usernameToEmail(username);
    const { error: authError } = await admin.auth.admin.updateUserById(
      input.userId,
      { email, email_confirm: true },
    );
    if (authError) throw authError;

    const { error } = await admin
      .from("profiles")
      .update({
        username,
        email,
        full_name: input.fullName.trim() || null,
      })
      .eq("id", input.userId);
    if (error) throw error;

    revalidatePath("/dashboard/users");
    return { ok: true, message: "User updated." };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not update the user.") };
  }
}
