import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase Configuration maintained via Environment Variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBtlciNYhSGiAO4npSIaSJYpocEAtPzO5w",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "apex-ml-4b1d9.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-ml-4b1d9",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "apex-ml-4b1d9.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "633780934728",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:633780934728:web:53526501757ed9b69d607d",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CEXBGYSTZP"
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics client-side
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

export { app, auth, db, analytics };

// Firestore Helper Functions

export interface TelemetryHistoryRecord {
  id?: string;
  device_id: string;
  device_name: string;
  device_model: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  battery_health: number;
  ssd_health: number;
  temperature_current: number;
  edhi: number;
  rul_months: number;
  recommendation: string;
  status_level: string;
  timestamp: string;
  created_at?: any;
}

export interface MaintenanceLogRecord {
  id?: string;
  device_id: string;
  action: string;
  rul_months: number;
  recommendation: string;
  status_level: string;
  edhi: number;
  timestamp: string;
  created_at?: any;
}

export interface FirestoreDeviceRecord {
  device_id: string;
  device_name: string;
  device_model: string;
  manufacturer: string;
  os_name: string;
  os_version: string;
  serial_number: string;
  assigned_user?: string;
  battery_health: number;
  ssd_health: number;
  edhi: number;
  rul_months: number;
  recommendation: string;
  status_level: string;
  status_color: string;
  last_seen?: string;
}

/**
 * Saves a hardware telemetry snapshot record into Firestore telemetry_history collection.
 */
export async function saveDeviceTelemetryHistory(
  deviceId: string,
  telemetry: any,
  prediction: any
): Promise<string | null> {
  try {
    const mlInput = prediction?.ml_input || {};
    const record: TelemetryHistoryRecord = {
      device_id: deviceId,
      device_name: telemetry?.device_name || "Unknown Device",
      device_model: telemetry?.device_model || "Standard Laptop",
      cpu_usage: telemetry?.cpu_usage || 0,
      ram_usage: telemetry?.ram_usage || 0,
      disk_usage: telemetry?.disk_usage || 0,
      battery_health: mlInput.battery_health ?? telemetry?.battery_health ?? 100,
      ssd_health: mlInput.ssd_health ?? telemetry?.ssd_health_percent ?? 100,
      temperature_current: telemetry?.temperature_current || 45,
      edhi: mlInput.edhi || 85,
      rul_months: prediction?.rul_months || 36,
      recommendation: prediction?.recommendation || "Healthy Device",
      status_level: prediction?.status_level || "healthy",
      timestamp: new Date().toISOString(),
      created_at: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "telemetry_history"), record);
    return docRef.id;
  } catch (error) {
    console.error("Firestore saveDeviceTelemetryHistory error:", error);
    return null;
  }
}

/**
 * Fetches recent telemetry history snapshots from Firestore database.
 */
export async function fetchDeviceHistory(
  deviceId?: string,
  limitCount = 30
): Promise<TelemetryHistoryRecord[]> {
  try {
    const historyRef = collection(db, "telemetry_history");
    let q;
    if (deviceId && deviceId !== "local") {
      q = query(
        historyRef,
        where("device_id", "==", deviceId),
        orderBy("created_at", "desc"),
        limit(limitCount)
      );
    } else {
      q = query(historyRef, orderBy("created_at", "desc"), limit(limitCount));
    }

    const snapshot = await getDocs(q);
    const results: TelemetryHistoryRecord[] = [];
    snapshot.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...(docSnap.data() as TelemetryHistoryRecord) });
    });
    return results;
  } catch (error) {
    console.warn("Firestore fetchDeviceHistory fallback (ignoring missing index if any):", error);
    try {
      const historyRef = collection(db, "telemetry_history");
      const snapshot = await getDocs(query(historyRef, limit(limitCount)));
      const results: TelemetryHistoryRecord[] = [];
      snapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...(docSnap.data() as TelemetryHistoryRecord) });
      });
      return results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    } catch (err) {
      console.error("Firestore fetch error:", err);
      return [];
    }
  }
}

/**
 * Saves a maintenance action event to Firestore maintenance_logs collection.
 */
export async function saveMaintenanceLog(
  deviceId: string,
  action: string,
  prediction: any
): Promise<string | null> {
  try {
    const mlInput = prediction?.ml_input || {};
    const logRecord: MaintenanceLogRecord = {
      device_id: deviceId,
      action,
      rul_months: prediction?.rul_months || 0,
      recommendation: prediction?.recommendation || "Updated",
      status_level: prediction?.status_level || "healthy",
      edhi: mlInput.edhi || 0,
      timestamp: new Date().toISOString(),
      created_at: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "maintenance_logs"), logRecord);
    return docRef.id;
  } catch (error) {
    console.error("Firestore saveMaintenanceLog error:", error);
    return null;
  }
}

/**
 * Fetches maintenance logs from Firestore database.
 */
export async function fetchMaintenanceLogs(limitCount = 20): Promise<MaintenanceLogRecord[]> {
  try {
    const logsRef = collection(db, "maintenance_logs");
    const snapshot = await getDocs(query(logsRef, limit(limitCount)));
    const results: MaintenanceLogRecord[] = [];
    snapshot.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...(docSnap.data() as MaintenanceLogRecord) });
    });
    return results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  } catch (error) {
    console.error("Firestore fetchMaintenanceLogs error:", error);
    return [];
  }
}

/**
 * Syncs current fleet device state to Firestore `devices` collection.
 */
export async function syncDeviceToFirestore(deviceRecord: any): Promise<void> {
  try {
    if (!deviceRecord || !deviceRecord.device_id) return;
    const devDoc = doc(db, "devices", deviceRecord.device_id);
    await setDoc(devDoc, {
      ...deviceRecord,
      updated_at: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Firestore syncDeviceToFirestore error:", error);
  }
}

/**
 * Fetches all fleet devices stored in Firestore `devices` collection.
 */
export async function fetchFirestoreDevices(): Promise<FirestoreDeviceRecord[]> {
  try {
    const devRef = collection(db, "devices");
    const snapshot = await getDocs(devRef);
    const results: FirestoreDeviceRecord[] = [];
    snapshot.forEach((docSnap) => {
      results.push(docSnap.data() as FirestoreDeviceRecord);
    });
    return results;
  } catch (error) {
    console.error("Firestore fetchFirestoreDevices error:", error);
    return [];
  }
}

/**
 * Subscribes to real-time sub-second updates from Firestore `devices` collection.
 */
export function subscribeToFirestoreDevices(callback: (devices: FirestoreDeviceRecord[]) => void) {
  try {
    const devRef = collection(db, "devices");
    return onSnapshot(devRef, (snapshot) => {
      const results: FirestoreDeviceRecord[] = [];
      snapshot.forEach((docSnap) => {
        results.push(docSnap.data() as FirestoreDeviceRecord);
      });
      callback(results);
    }, (error) => {
      console.warn("Firestore real-time devices subscription notice:", error);
    });
  } catch (error) {
    console.error("subscribeToFirestoreDevices init error:", error);
    return () => {};
  }
}
