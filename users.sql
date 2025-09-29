-- Clean UTF8MB4 schema for `webdb`.`users`
-- Safe to run on a fresh database OR migrate an existing one.
-- If migrating existing latin1 table with broken Thai enum, follow MIGRATION STEPS below.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `webdb`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `webdb`;

-- Drop old table only if you are sure you no longer need legacy data
-- (Comment this line out if you intend to ALTER instead of DROP)
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `firstname` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastname`  VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `age` INT NOT NULL,
  `gender` ENUM('ชาย','หญิง','ไม่ระบุ') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `interests` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Optional) seed sample data
INSERT INTO `users` (`firstname`,`lastname`,`age`,`gender`,`interests`,`description`) VALUES
('ทดสอบ','หนึ่ง',25,'ชาย','หนังสือ, วิดีโอเกม','ผู้ใช้ตัวอย่าง'),
('ทดสอบ','สอง',30,'หญิง','การเมือง','ผู้ใช้ตัวอย่าง 2');

-- MIGRATION STEPS (ถ้าตารางเดิมยังมีข้อมูลที่ต้องการเก็บ)
-- 1. RENAME TABLE users TO users_old;
-- 2. สร้างตารางใหม่ด้วยสคริปต์นี้ (ลบ DROP TABLE IF EXISTS ออก และอย่า seed ซ้ำ)
-- 3. คัดลอกข้อมูล (map เพศถ้าพัง):
--    INSERT INTO users (firstname,lastname,age,gender,interests,description)
--    SELECT firstname,lastname,age,
--           CASE gender
--             WHEN 'ชาย' THEN 'ชาย'
--             WHEN 'หญิง' THEN 'หญิง'
--             WHEN 'ไม่ระบุ' THEN 'ไม่ระบุ'
--             ELSE 'ไม่ระบุ'
--           END,
--           interests,description
--    FROM users_old;
-- 4. ตรวจสอบข้อมูลแล้วค่อย DROP TABLE users_old;

-- END
