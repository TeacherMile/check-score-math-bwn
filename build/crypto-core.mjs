// crypto-core.mjs
// โมดูลเข้ารหัส/ถอดรหัส ใช้ร่วมกันทั้งฝั่ง Node (สร้างไฟล์) และเบราว์เซอร์
// พารามิเตอร์ต้องตรงกันเป๊ะทั้งสองฝั่ง มิฉะนั้นจะถอดรหัสไม่ได้
//
// วิธีการ: derive คีย์ AES-GCM จาก "เบอร์โทร" ของนักเรียนด้วย PBKDF2
// คะแนนของแต่ละคนถูกเข้ารหัสด้วยคีย์นี้ ผู้ที่ไม่รู้เบอร์จึงถอดดูคะแนนไม่ได้

export const PBKDF2_ITERATIONS = 100000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(str) {
  const s = atob(str);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

// ทำให้เบอร์โทรเป็นรูปแบบมาตรฐาน: ถ้ามี 2 เบอร์คั่นด้วย "/" ใช้เบอร์แรก, ตัดอักขระที่ไม่ใช่ตัวเลขออก
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim();
  if (s.includes("/")) s = s.split("/")[0];
  return s.replace(/\D/g, "");
}

async function deriveKey(phone, saltBytes) {
  const base = await crypto.subtle.importKey(
    "raw", enc.encode(phone), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// เข้ารหัส object -> {s: salt, i: iv, c: ciphertext} (ทั้งหมดเป็น base64)
export async function encryptRecord(phone, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(phone, salt);
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))
  );
  return { s: bytesToB64(salt), i: bytesToB64(iv), c: bytesToB64(new Uint8Array(ctBuf)) };
}

// ถอดรหัส -> object, ถ้าเบอร์ผิดจะ throw
export async function decryptRecord(phone, rec) {
  const salt = b64ToBytes(rec.s);
  const iv = b64ToBytes(rec.i);
  const ct = b64ToBytes(rec.c);
  const key = await deriveKey(phone, salt);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(new Uint8Array(ptBuf)));
}
