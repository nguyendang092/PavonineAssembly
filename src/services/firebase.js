// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  remove,
  update,
  get,
  query,
  orderByKey,
  startAt,
  endAt,
  runTransaction,
  off,
} from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBJcT3NZYg7_BfW_J9SKuxqiWS0o9SPhTo",
  authDomain: "pavoassembly.firebaseapp.com",
  projectId: "pavoassembly",
  storageBucket: "pavoassembly.appspot.com",
  messagingSenderId: "69575955552",
  appId: "1:69575955552:web:9e324b0b4a4ecdbb085f05",
  databaseURL: "https://pavoassembly-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

/** Chờ Auth khôi phục từ IndexedDB — `get()` trước đó sẽ bị rules `auth != null` từ chối. */
export function waitForFirebaseAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// Export thêm các hàm thao tác database phổ biến
export {
  db,
  ref,
  set,
  onValue,
  push,
  remove,
  update,
  get,
  query,
  orderByKey,
  startAt,
  endAt,
  runTransaction,
  off,
};

// Export Storage functions
export { storage, storageRef, uploadBytes, getDownloadURL, deleteObject };
