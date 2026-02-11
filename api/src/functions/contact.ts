import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { EmailClient } from "@azure/communication-email";

interface ContactForm {
  nombre: string;
  email: string;
  tipoEvento: string;
  fecha: string;
  mensaje: string;
}

const TIPOS_EVENTO: Record<string, string> = {
  cumpleanos: "Fiesta de cumpleaños",
  corporativo: "Evento corporativo",
  matrimonio: "Matrimonio",
  graduacion: "Graduación",
  festival: "Festival / Fiesta masiva",
  privado: "Evento privado",
  otro: "Otro",
};

app.http("contact", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "contact",
  handler: async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as ContactForm;

      // Validar campos requeridos
      if (
        !body.nombre ||
        !body.email ||
        !body.tipoEvento ||
        !body.fecha ||
        !body.mensaje
      ) {
        return {
          status: 400,
          jsonBody: { error: "Todos los campos son requeridos" },
        };
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return {
          status: 400,
          jsonBody: { error: "Email inválido" },
        };
      }

      const tipoLabel = TIPOS_EVENTO[body.tipoEvento] ?? body.tipoEvento;

      // ── 1. Guardar en Azure Table Storage ──
      const storageConnectionString = process.env["STORAGE_CONNECTION_STRING"];
      if (storageConnectionString) {
        const tableClient = TableClient.fromConnectionString(
          storageConnectionString,
          "cotizaciones"
        );

        // Crear tabla si no existe
        await tableClient.createTable().catch(() => {});

        const now = new Date();
        await tableClient.createEntity({
          partitionKey: "cotizacion",
          rowKey: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          nombre: body.nombre,
          email: body.email,
          tipoEvento: tipoLabel,
          fechaEvento: body.fecha,
          mensaje: body.mensaje,
          fechaCreacion: now.toISOString(),
        });

        context.log("Cotización guardada en Table Storage");
      }

      // ── 2. Enviar email con Azure Communication Services ──
      const emailConnectionString = process.env["EMAIL_CONNECTION_STRING"];
      const senderAddress = process.env["EMAIL_SENDER_ADDRESS"];
      const notificationEmail = process.env["NOTIFICATION_EMAIL"];

      if (emailConnectionString && senderAddress && notificationEmail) {
        const emailClient = new EmailClient(emailConnectionString);

        const message = {
          senderAddress,
          content: {
            subject: `📩 Nueva Cotización — ${tipoLabel}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#4a7aff;">Nueva Cotización — Subsonic Producciones</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Nombre</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.nombre}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${body.email}">${body.email}</a></td></tr>
                  <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Tipo de Evento</td><td style="padding:8px;border-bottom:1px solid #eee;">${tipoLabel}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Fecha</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.fecha}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Mensaje</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.mensaje}</td></tr>
                </table>
                <p style="margin-top:16px;color:#888;font-size:12px;">Enviado desde el formulario de contacto de subsonicproducciones.cl</p>
              </div>
            `,
          },
          recipients: {
            to: [{ address: notificationEmail }],
          },
        };

        const poller = await emailClient.beginSend(message);
        await poller.pollUntilDone();
        context.log("Email de notificación enviado");
      }

      // Log de respaldo (siempre visible en Log Stream)
      context.log("=== NUEVA COTIZACIÓN ===");
      context.log(`Nombre: ${body.nombre} | Email: ${body.email}`);
      context.log(`Tipo: ${tipoLabel} | Fecha: ${body.fecha}`);
      context.log(`Mensaje: ${body.mensaje}`);

      return {
        status: 200,
        jsonBody: { message: "¡Mensaje enviado con éxito!" },
      };
    } catch (error) {
      context.error("Error procesando formulario:", error);
      return {
        status: 500,
        jsonBody: { error: "Error interno del servidor" },
      };
    }
  },
});
