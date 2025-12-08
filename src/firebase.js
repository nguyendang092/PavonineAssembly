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
} from "firebase/database";
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

// Export thêm các hàm thao tác database phổ biến
export { db, ref, set, onValue, push, remove, update };

// Export Storage functions
export { storage, storageRef, uploadBytes, getDownloadURL, deleteObject };
