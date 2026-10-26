/** Traducciones y explicaciones en lenguaje simple de los términos de Meta (Facebook e Instagram Ads). */

export const OBJECTIVES: Record<string, { label: string; help: string }> = {
  OUTCOME_LEADS: { label: "Clientes potenciales", help: "Busca personas que dejen sus datos (por ejemplo, un formulario) para que luego les des seguimiento." },
  OUTCOME_ENGAGEMENT: { label: "Interacción / Mensajes", help: "Busca que la gente interactúe con tu publicación o te escriba por mensaje (WhatsApp, Messenger o Instagram)." },
  OUTCOME_TRAFFIC: { label: "Tráfico", help: "Busca que más personas entren a tu sitio web o a otro destino." },
  OUTCOME_AWARENESS: { label: "Reconocimiento", help: "Busca que más personas vean y recuerden la marca. No busca ventas inmediatas." },
  OUTCOME_SALES: { label: "Ventas", help: "Busca compras u otras acciones de valor en tu sitio o tienda." },
  OUTCOME_APP_PROMOTION: { label: "Promoción de app", help: "Busca que instalen o usen una aplicación." },
  LINK_CLICKS: { label: "Tráfico (clics en el enlace)", help: "Objetivo anterior de Meta: busca clics hacia un enlace." },
  MESSAGES: { label: "Mensajes", help: "Objetivo anterior de Meta: busca conversaciones por mensaje." },
  LEAD_GENERATION: { label: "Clientes potenciales", help: "Objetivo anterior de Meta: busca formularios completados." },
  REACH: { label: "Alcance", help: "Objetivo anterior de Meta: busca llegar a la mayor cantidad de personas." },
  BRAND_AWARENESS: { label: "Reconocimiento de marca", help: "Objetivo anterior de Meta: busca que recuerden la marca." },
  CONVERSIONS: { label: "Conversiones", help: "Objetivo anterior de Meta: busca acciones en tu sitio (compras, registros…)." },
};

export const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "off" | "bad"; help: string }> = {
  ACTIVE: { label: "Activa", tone: "ok", help: "Se está mostrando (o se mostrará en su horario) y puede gastar presupuesto." },
  PAUSED: { label: "Pausada", tone: "off", help: "No se muestra ni gasta presupuesto. La pausó alguien a propósito." },
  DELETED: { label: "Eliminada", tone: "off", help: "Fue eliminada en Meta." },
  ARCHIVED: { label: "Archivada", tone: "off", help: "Guardada en el archivo; no se muestra." },
  IN_PROCESS: { label: "Procesando", tone: "warn", help: "Meta todavía la está procesando." },
  WITH_ISSUES: { label: "Con problemas", tone: "bad", help: "Meta encontró algo que revisar (por ejemplo, un problema de pago o de política)." },
  PENDING_REVIEW: { label: "En revisión", tone: "warn", help: "Meta la está revisando antes de mostrarla. Suele tardar menos de 24 horas." },
  DISAPPROVED: { label: "Rechazada", tone: "bad", help: "Meta no la aprobó porque incumple alguna política. Hay que corregirla." },
  PREAPPROVED: { label: "Preaprobada", tone: "warn", help: "Está programada y pasó una primera revisión." },
  PENDING_BILLING_INFO: { label: "Falta información de pago", tone: "bad", help: "La cuenta publicitaria necesita un método de pago válido." },
  CAMPAIGN_PAUSED: { label: "Campaña pausada", tone: "off", help: "Está activa, pero la campaña a la que pertenece está pausada." },
  ADSET_PAUSED: { label: "Conjunto pausado", tone: "off", help: "Está activo, pero el conjunto de anuncios al que pertenece está pausado." },
};

export const OPTIMIZATION: Record<string, string> = {
  LEAD_GENERATION: "Conseguir formularios completados",
  QUALITY_LEAD: "Conseguir formularios de mejor calidad",
  CONVERSATIONS: "Conseguir conversaciones por mensaje",
  LINK_CLICKS: "Conseguir clics en el enlace",
  LANDING_PAGE_VIEWS: "Conseguir visitas reales a la página (que cargue completa)",
  REACH: "Llegar a la mayor cantidad de personas distintas",
  IMPRESSIONS: "Mostrar el anuncio la mayor cantidad de veces",
  POST_ENGAGEMENT: "Conseguir reacciones, comentarios y compartidos",
  OFFSITE_CONVERSIONS: "Conseguir acciones en tu sitio web (compras, registros…)",
  THRUPLAY: "Conseguir que vean el video completo (o 15 segundos)",
  VALUE: "Conseguir las compras de más valor",
};

export const SPECIAL_CATEGORIES: Record<string, string> = {
  CREDIT: "Crédito",
  EMPLOYMENT: "Empleo",
  HOUSING: "Vivienda",
  ISSUES_ELECTIONS_POLITICS: "Política, elecciones o temas sociales",
  ONLINE_GAMBLING_AND_GAMING: "Apuestas y juegos en línea",
  FINANCIAL_PRODUCTS_SERVICES: "Productos y servicios financieros",
};

export const CTA: Record<string, string> = {
  LEARN_MORE: "Más información",
  SHOP_NOW: "Comprar ahora",
  SIGN_UP: "Registrarte",
  CONTACT_US: "Contáctanos",
  SEND_MESSAGE: "Enviar mensaje",
  WHATSAPP_MESSAGE: "Enviar mensaje por WhatsApp",
  GET_QUOTE: "Solicitar cotización",
  APPLY_NOW: "Solicitar ahora",
  BOOK_TRAVEL: "Reservar",
  CALL_NOW: "Llamar ahora",
  NO_BUTTON: "Sin botón",
};

export const label = (map: Record<string, string | { label: string }>, key: string | null | undefined) => {
  if (!key) return "—";
  const v = map[key];
  return v ? (typeof v === "string" ? v : v.label) : key;
};

/** Lo que Meta devuelve como presupuesto viene en centavos de la moneda de la cuenta. */
export const money = (cents: string | number | null | undefined, currency = "MXN") =>
  cents === null || cents === undefined || cents === "" ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(cents) / 100);

export const LAYERS = {
  campaign: { title: "Campaña", help: "La campaña es el nivel más alto: define el OBJETIVO (qué quieres lograr: mensajes, clientes potenciales, visitas…). Dentro de una campaña viven uno o varios conjuntos de anuncios." },
  adset: { title: "Conjunto de anuncios", help: "El conjunto define A QUIÉN le muestras (público, ubicación, edad), DÓNDE (Facebook, Instagram…), CUÁNDO (fechas) y CUÁNTO gastas (presupuesto). Dentro viven los anuncios." },
  ad: { title: "Anuncio", help: "El anuncio es lo que la gente VE: la imagen o video, el texto principal, el título y el botón. Es lo que más se modifica cuando un cliente pide cambios." },
} as const;
