// generate.mjs
// สร้างไฟล์ข้อมูลสาธารณะจากบัญชีรายชื่อส่วนตัว (มีเลขประจำตัว + เบอร์โทร):
//   data/records.json  -> ข้อมูลของนักเรียน (ชื่อ, ห้อง, คะแนน, ข้อที่ผิด)
//                         เข้ารหัสด้วยเบอร์โทรของแต่ละคน, ใช้ "เลขประจำตัวนักเรียน" เป็นคีย์
//
// ไฟล์สาธารณะจะเปิดเผยเพียง "เลขประจำตัวนักเรียน" เท่านั้น ไม่มีชื่อ/เบอร์/คะแนนแบบอ่านออกได้
//
// ใช้: node build/generate.mjs <roster_private.json> [โฟลเดอร์ปลายทาง=data]
// รูปแบบไฟล์รายชื่อส่วนตัว: array ของ
//   { no, student_id, prefix, first, last, classroom, phone, score(|null), max, wrong:[...] }

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { encryptRecord, normalizePhone } from "./crypto-core.mjs";

const inPath = process.argv[2];
const outDir = process.argv[3] || "data";
if (!inPath) {
  console.error("ใช้: node build/generate.mjs <roster_private.json> [outDir]");
  process.exit(1);
}

const roster = JSON.parse(readFileSync(inPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const records = {};
const skippedNoPhone = [];
const skippedNoId = [];

for (const r of roster) {
  const id = r.student_id ? String(r.student_id).trim() : "";
  if (!id) { skippedNoId.push(r.no); continue; }

  const phone = normalizePhone(r.phone);
  if (!phone) { skippedNoPhone.push(id); continue; }

  const payload = {
    name: `${r.prefix || ""}${(r.first || "").trim()} ${(r.last || "").trim()}`.trim(),
    classroom: r.classroom || "",
    score: (r.score === undefined || r.score === "") ? null : r.score,
    max: r.max ?? 30,
    wrong: Array.isArray(r.wrong) ? r.wrong : [],
  };
  records[id] = await encryptRecord(phone, payload);
}

writeFileSync(`${outDir}/records.json`, JSON.stringify(records));

console.log(`เขียน ${outDir}/records.json (${Object.keys(records).length} รายการเข้ารหัส)`);
if (skippedNoPhone.length) console.log(`ข้าม (ไม่มีเบอร์โทร) เลขประจำตัว: ${skippedNoPhone.join(", ")}`);
if (skippedNoId.length) console.log(`ข้าม (ไม่มีเลขประจำตัว) ลำดับที่: ${skippedNoId.join(", ")}`);
