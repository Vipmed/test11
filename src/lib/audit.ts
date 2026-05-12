import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export enum AuditEventType {
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  TEST_START = "TEST_START",
  TEST_COMPLETE = "TEST_COMPLETE",
  DB_IMPORT = "DB_IMPORT",
  DB_DELETE = "DB_DELETE",
  SYSTEM_CONFIG_CHANGE = "SYSTEM_CONFIG_CHANGE",
  USER_APPROVED = "USER_APPROVED",
  USER_BLOCKED = "USER_BLOCKED",
  USER_ROLE_CHANGE = "USER_ROLE_CHANGE",
  USER_DELETED = "USER_DELETED",
  USER_CREATED = "USER_CREATED",
  SAVED_QUESTION = "SAVED_QUESTION",
  REPORT_SUBMITTED = "REPORT_SUBMITTED",
  REPORT_ACTION = "REPORT_ACTION",
  QUESTION_EDIT = "QUESTION_EDIT",
  QUESTION_DELETE = "QUESTION_DELETE",
}

export async function logEvent(event: AuditEventType, detail: string, userId?: string, email?: string) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      event,
      detail,
      userId: userId || "system",
      email: email || "system",
      timestamp: serverTimestamp(),
      ip: "internal", // In a real app, you'd get this from the server
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
