// Clientes con los datos que los formularios de documentos rellenan solos (solo servidor).
import { prisma } from "@/lib/prisma";

export type ClientOpt = {
  id: string;
  name: string;
  razon: string; // razón social (o el nombre del cliente si no hay)
  domicilio: string;
  contacto: string;
  prefix: string;
  nextReceipt: number;
  mails: string;
  rep: { nombre: string; domicilio: string; curp: string; ine: string; rol: string };
};

export async function getClientOpts(): Promise<ClientOpt[]> {
  const rows = await prisma.client.findMany({ orderBy: { companyName: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    name: c.companyName,
    razon: c.legalName?.trim() || c.companyName,
    domicilio: [c.street, c.colonia && `Col. ${c.colonia}`, c.postalCode && `C.P. ${c.postalCode}`, c.city, c.state].filter(Boolean).join(", "),
    contacto: [c.contactName, c.contactLastName].filter(Boolean).join(" "),
    prefix: c.folioPrefix,
    nextReceipt: c.receiptSeq + 1,
    mails: [c.mainEmails, c.contactEmail].filter(Boolean).join(", "),
    rep: { nombre: c.legalRepName ?? "", domicilio: c.legalRepAddress ?? "", curp: c.legalRepCurp ?? "", ine: c.legalRepIne ?? "", rol: c.legalRepRole ?? "" },
  }));
}
