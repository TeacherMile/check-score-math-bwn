// generate.mjs
// สร้างไฟล์ข้อมูลสาธารณะ 2 ไฟล์จากบัญชีรายชื่อส่วนตัว (มีเบอร์โทร):
//   data/students.json  -> รายชื่อสำหรับดรอปดาวน์ (ชื่อ + ห้อง เท่านั้น ไม่มีเบอร์/คะแนน)
//   data/records.json   -> คะแนน+ข้อที่ผิด ที่เข้ารหัสด้วยเบอร์โทรของแต่ละคน
//
// ใช้: node build/generate.mjs <ไฟล์รายชื่อส่วนตัว.json> [โฟลเดอร์ปลายทาง=data]
// รูปแบบไฟล์รายชื่อส่วนตัว: array ของ
//   { no, prefix, first, last, classroom, phone, score(|null), max, wrong:[...] }

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { encryptRecord, normalizePhone } from "./crypto-core.mjs";

const inPath = process.argv[2];
const outDir = process.argv[3] || "data";
if (!inPath) {
  console.error("ใช้: node build/generate.mjs <roster_full_private.json> [outDir]");
  process.exit(1);
}

const roster = JSON.parse(readFileSync(inPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const students = [];
const records = {};
const skipped = [];

for (const r of roster) {
  const no = r.no;
  students.push({
    no,
    prefix: r.prefix || "",
    first: (r.first || "").trim(),
    last: (r.last || "").trim(),
    classroom: r.classroom || "",
  });

  const phone = normalizePhone(r.phone);
  if (!phone) {
    // ไม่มีเบอร์โทร -> ล็อกอินไม่ได้จนกว่าจะเพิ่มเบอร์ (ข้ามการเข้ารหัส)
    skipped.push(no);
    continue;
  }
  const payload = {
    score: r.score === undefined ? null : r.score,
    max: r.max ?? 30,
    wrong: Array.isArray(r.wrong) ? r.wrong : [],
  };
  records[no] = await encryptRecord(phone, payload);
}

students.sort((a, b) => a.no - b.no);

writeFileSync(`${outDir}/students.json`, JSON.stringify(students, null, 0));
writeFileSync(`${outDir}/records.json`, JSON.stringify(records, null, 0));

console.log(`เขียน ${outDir}/students.json (${students.length} คน)`);
console.log(`เขียน ${outDir}/records.json (${Object.keys(records).length} รายการเข้ารหัส)`);
if (skipped.length) {
  console.log(`ข้าม (ไม่มีเบอร์โทร) ลำดับที่: ${skipped.join(", ")}`);
}
