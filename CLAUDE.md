\# MASTER PROMPT \& SYSTEM SPECIFICATION FOR CLAUDE CODE



\## PROJECT OVERVIEW

Build a web-based corporate reporting platform for "311 CONSULTORES" deployed at `proyectos.311consultores.com`.

The platform enables Editors and Admins to capture activity reports with real-time autosave, compressed multimedia evidence, automated custom folios, PDF generation, and automated email dispatching via Gmail API.



\---



\## TECH STACK REQUIREMENTS

\- \*\*Frontend\*\*: Next.js 14+ (App Router, TypeScript), Tailwind CSS, Shadcn UI, Tiptap/Quill (Rich Text Editor), Lucide Icons.

\- \*\*Backend\*\*: Next.js Server Actions / API Routes, Node.js.

\- \*\*Database\*\*: PostgreSQL with Prisma ORM.

\- \*\*Storage\*\*: AWS S3 / DigitalOcean Spaces (S3 API compatible) for evidence files.

\- \*\*Email Dispatch\*\*: `@googleapis/gmail` (Google Workspace OAuth2 / Service Account).

\- \*\*PDF Generation\*\*: `@react-pdf/renderer` or `puppeteer` / `playwright` server-side rendering.

\- \*\*Image Compression\*\*: `browser-image-compression` on client-side before upload.



\---



\## DATABASE SCHEMA (Prisma Syntax)



```prisma

datasource db {

&#x20; provider = "postgresql"

&#x20; url      = env("DATABASE\_URL")

}



generator client {

&#x20; provider = "prisma-client-js"

}



enum Role {

&#x20; ADMIN

&#x20; EDITOR

&#x20; CLIENTE

}



enum ReportStatus {

&#x20; EN\_PROCESO

&#x20; TERMINADO

&#x20; RECHAZADO

&#x20; APROBADO

&#x20; ENVIADO

}



enum DeletionStatus {

&#x20; PENDIENTE

&#x20; APROBADO

&#x20; RECHAZADO

}



model User {

&#x20; id               String            @id @default(uuid())

&#x20; name             String

&#x20; email            String            @unique

&#x20; passwordHash     String

&#x20; role             Role              @default(EDITOR)

&#x20; active           Boolean           @default(true)

&#x20; createdAt        DateTime          @default(now())

&#x20; updatedAt        DateTime          @updatedAt

&#x20; reportsCreated   Report\[]          @relation("ReportCreator")

&#x20; tasksCreated     ReportTask\[]

&#x20; deletionRequests DeletionRequest\[] @relation("DeletionRequester")

&#x20; deletionReviews  DeletionRequest\[] @relation("DeletionReviewer")

&#x20; auditLogs        AuditLog\[]

&#x20; clientAccess     ClientUser\[]

}



model Client {

&#x20; id               String       @id @default(uuid())

&#x20; companyName      String

&#x20; folioPrefix      String       @unique // E.g., "CEM"

&#x20; mainEmails       String       // Comma-separated emails

&#x20; logoUrl          String?

&#x20; createdAt        DateTime     @default(now())

&#x20; projects         Project\[]

&#x20; reports          Report\[]

&#x20; users            ClientUser\[]

}



model Project {

&#x20; id            String    @id @default(uuid())

&#x20; clientId      String

&#x20; client        Client    @relation(fields: \[clientId], references: \[id], onDelete: Cascade)

&#x20; projectName   String

&#x20; projectEmails String    // Comma-separated emails

&#x20; createdAt     DateTime  @default(now())

&#x20; reports       Report\[]

}



model ClientUser {

&#x20; userId   String

&#x20; clientId String

&#x20; user     User   @relation(fields: \[userId], references: \[id], onDelete: Cascade)

&#x20; client   Client @relation(fields: \[clientId], references: \[id], onDelete: Cascade)



&#x20; @@id(\[userId, clientId])

}



model Report {

&#x20; id                 String            @id @default(uuid())

&#x20; folio              String            @unique // E.g., "311CEM001"

&#x20; clientId           String

&#x20; client             Client            @relation(fields: \[clientId], references: \[id])

&#x20; projectId          String

&#x20; project            Project           @relation(fields: \[projectId], references: \[id])

&#x20; startDate          DateTime

&#x20; endDate            DateTime

&#x20; consultants        String\[]          // Array of names from 311 CONSULTORES

&#x20; status             ReportStatus      @default(EN\_PROCESO)

&#x20; rejectionComment   String?

&#x20; createdById        String

&#x20; createdBy          User              @relation("ReportCreator", fields: \[createdById], references: \[id])

&#x20; createdAt          DateTime          @default(now())

&#x20; updatedAt          DateTime          @updatedAt

&#x20; tasks              ReportTask\[]

&#x20; auditLogs          AuditLog\[]

}



model ReportTask {

&#x20; id             String   @id @default(uuid())

&#x20; reportId       String

&#x20; report         Report   @relation(fields: \[reportId], references: \[id], onDelete: Cascade)

&#x20; sequentialNum  Int

&#x20; descriptionHtml String  // Rich Text HTML

&#x20; evidenceUrl    String?

&#x20; evidenceType   String?  // 'IMAGE', 'PDF', 'VIDEO'

&#x20; createdById    String

&#x20; createdBy      User     @relation(fields: \[createdById], references: \[id])

&#x20; createdAt      DateTime @default(now())

&#x20; updatedAt      DateTime @updatedAt

}



model DeletionRequest {

&#x20; id             String         @id @default(uuid())

&#x20; targetType     String         // 'REPORT', 'TASK', 'CLIENT', 'PROJECT'

&#x20; targetId       String

&#x20; reason         String?

&#x20; requestedById  String

&#x20; requestedBy    User           @relation("DeletionRequester", fields: \[requestedById], references: \[id])

&#x20; status         DeletionStatus @default(PENDIENTE)

&#x20; reviewedById   String?

&#x20; reviewedBy     User?          @relation("DeletionReviewer", fields: \[reviewedById], references: \[id])

&#x20; createdAt      DateTime       @default(now())

&#x20; resolvedAt     DateTime?

}



model AuditLog {

&#x20; id        String   @id @default(uuid())

&#x20; reportId  String?

&#x20; report    Report?  @relation(fields: \[reportId], references: \[id], onDelete: Cascade)

&#x20; userId    String

&#x20; user      User     @relation(fields: \[userId], references: \[id])

&#x20; action    String   // E.g., "EDITED\_TASK\_2", "STATUS\_CHANGE\_TERMINADO"

&#x20; details   Json?

&#x20; createdAt DateTime @default(now())

}

