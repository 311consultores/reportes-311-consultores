-- AlterTable
ALTER TABLE `Client` ADD COLUMN `billingLastName` VARCHAR(150) NULL,
    ADD COLUMN `contactLastName` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `ClientRegistration` ADD COLUMN `billingLastName` VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN `contactLastName` VARCHAR(150) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `responsibleLastName` VARCHAR(120) NULL,
    ADD COLUMN `responsibleName` VARCHAR(120) NULL;

-- Datos existentes: el nombre completo se separa en nombre (primera palabra) y apellido (el resto).
-- Primero se llena el apellido (usa el nombre original) y después se recorta el nombre.
UPDATE `Client` SET `contactLastName` = TRIM(SUBSTRING(`contactName`, LOCATE(' ', `contactName`) + 1)), `contactName` = SUBSTRING_INDEX(`contactName`, ' ', 1)
  WHERE `contactName` IS NOT NULL AND LOCATE(' ', `contactName`) > 0;
UPDATE `Client` SET `billingLastName` = TRIM(SUBSTRING(`billingName`, LOCATE(' ', `billingName`) + 1)), `billingName` = SUBSTRING_INDEX(`billingName`, ' ', 1)
  WHERE `billingName` IS NOT NULL AND LOCATE(' ', `billingName`) > 0;
UPDATE `ClientRegistration` SET `contactLastName` = TRIM(SUBSTRING(`contactName`, LOCATE(' ', `contactName`) + 1)), `contactName` = SUBSTRING_INDEX(`contactName`, ' ', 1)
  WHERE LOCATE(' ', `contactName`) > 0;
UPDATE `ClientRegistration` SET `billingLastName` = TRIM(SUBSTRING(`billingName`, LOCATE(' ', `billingName`) + 1)), `billingName` = SUBSTRING_INDEX(`billingName`, ' ', 1)
  WHERE LOCATE(' ', `billingName`) > 0;
