
"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { getReportLayout } from "@/lib/report-layout";

const MAX_USERS = 6;

// --- USER MANAGEMENT FUNCTIONS ---

export async function listUsers() {
  if (!adminAuth) {
    console.error("Admin SDK not available.");
    return [];
  }
  try {
    const result = await adminAuth.listUsers();
    return result.users.map((user) => ({
      uid: user.uid,
      email: user.email ?? "—",
      createdAt: user.metadata.creationTime,
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function canCreateUser() {
  if (!adminAuth) return false;
  try {
    const result = await adminAuth.listUsers();
    return result.users.length < MAX_USERS;
  } catch (error) {
    return false;
  }
}

export async function createUser(formData: FormData) {
  if (!adminAuth || !adminDb) throw new Error("Server configuration error.");
  const email = formData.get("email") as string;
  if (!email) throw new Error("Email is required");

  const existing = await adminAuth.listUsers();
  if (existing.users.length >= MAX_USERS) {
    throw new Error(`Limit of ${MAX_USERS} reached.`);
  }

  const tempPassword = Math.random().toString(36).slice(-10);
  const userRecord = await adminAuth.createUser({ email, password: tempPassword });

  await adminDb.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: userRecord.email,
    role: 'user',
    plan: 'free',
    createdAt: new Date(),
  });

  revalidatePath("/users");
}

export async function updateUser(formData: FormData) {
  if (!adminAuth) throw new Error("Server configuration error.");
  const uid = formData.get("uid") as string;
  const email = formData.get("email") as string;
  await adminAuth.updateUser(uid, { email });
  revalidatePath("/users");
}

export async function deleteUser(formData: FormData) {
  if (!adminAuth || !adminDb) throw new Error("Server configuration error.");
  const uid = formData.get("uid") as string;
  await adminAuth.deleteUser(uid);
  await adminDb.collection('users').doc(uid).delete();
  revalidatePath("/users");
}

// --- BRANDED REPORT GENERATION ---

export async function generateUsersReport(payload: { 
  users: any[], 
  clientTimezone: string, 
  translations: any 
}) {
  try {
    const t = payload.translations;
    
    const bodyContent = `
        <div class="section">
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>${t.emailLabel}</th>
                <th>${t.createdLabel}</th>
              </tr>
            </thead>
            <tbody>
              ${payload.users.map((user, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="border-left: 4px solid #3560AD; padding-left: 10px;"><strong>${user.email}</strong></td>
                  <td>${user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "—"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
    `;

    const html = getReportLayout({
      title: t.reportTitle,
      body: bodyContent,
      clientTimezone: payload.clientTimezone,
    });

    return { success: true, reportContent: html };
  } catch (error) {
    console.error('Error generating users report:', error);
    return { success: false, error: `{t('ReportErrors.failedToGenerate')}` };
  }
}
