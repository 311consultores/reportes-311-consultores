-- AlterTable
-- Evolutivo 9: nuevo rol PROJECT_311 (solo agrega un valor; no toca datos)
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'EDITOR', 'CLIENTE', 'TEAM_311', 'PROJECT_311') NOT NULL DEFAULT 'EDITOR';
