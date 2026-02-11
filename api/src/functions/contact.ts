import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";
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

      // Formatear fecha a dd/MM/yyyy (Chile)
      const fechaFormateada = (() => {
        const [y, m, d] = body.fecha.split("-");
        return `${d}/${m}/${y}`;
      })();

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
            subject: `⚡ Nueva Cotización — ${tipoLabel}`,
            html: `
              <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
                <!-- Header -->
                <div style="background:#1a1a2e;padding:32px 32px 28px;text-align:center;">
                  <div style="font-size:28px;margin-bottom:8px;">⚡</div>
                  <h1 style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">SUBSONIC PRODUCCIONES</h1>
                  <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:0.08em;text-transform:uppercase;">Nueva Cotización</p>
                </div>

                <!-- Datos -->
                <div style="padding:24px 32px 8px;">
                  <div style="border-bottom:1px solid #f0f0f0;padding:14px 0;">
                    <div style="font-size:11px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">👤 Nombre</div>
                    <div style="font-size:15px;color:#1a1a2e;">${body.nombre}</div>
                  </div>
                  <div style="border-bottom:1px solid #f0f0f0;padding:14px 0;">
                    <div style="font-size:11px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">✉️ Email</div>
                    <div style="font-size:15px;"><a href="mailto:${body.email}" style="color:#4a7aff;text-decoration:none;">${body.email}</a></div>
                  </div>
                  <div style="border-bottom:1px solid #f0f0f0;padding:14px 0;">
                    <div style="font-size:11px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">📅 Fecha del Evento</div>
                    <div style="font-size:15px;color:#1a1a2e;">${fechaFormateada}</div>
                  </div>
                  <div style="border-bottom:1px solid #f0f0f0;padding:14px 0;">
                    <div style="font-size:11px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">🎵 Tipo de Evento</div>
                    <div style="font-size:15px;color:#1a1a2e;">${tipoLabel}</div>
                  </div>
                  <div style="padding:14px 0;">
                    <div style="font-size:11px;font-weight:700;color:#999999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">💬 Mensaje</div>
                    <div style="font-size:15px;color:#444444;line-height:1.6;">${body.mensaje}</div>
                  </div>
                </div>

                <!-- Footer -->
                <div style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f0f0f0;">
                  <p style="margin:0;font-size:11px;color:#bbbbbb;">Solicitud recibida el ${new Date().toLocaleDateString('es-CL')} · subsonicproducciones.cl</p>
                </div>
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
