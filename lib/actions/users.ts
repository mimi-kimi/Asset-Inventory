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

export async function createInspector(input: {
  username: string;
  fullName: string;
  password: string;
  mustChange: boolean;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const username = normalizeUsername(input.username);

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
          role: "INSPECTOR",
          active: true,
          must_change_password: input.mustChange,
        })
        .eq("id", userId);
      if (profileError) throw profileError;
    }

    revalidatePath("/dashboard/users");
    return { ok: true, message: `Inspector "${username}" created.` };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not create the user.") };
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
