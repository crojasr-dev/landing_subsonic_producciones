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
              <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#050a15;border-radius:16px;overflow:hidden;border:1px solid rgba(74,122,255,0.15);">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,rgba(74,122,255,0.15),rgba(168,85,247,0.1));padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="font-size:28px;margin-bottom:8px;">⚡</div>
                  <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">SUBSONIC PRODUCCIONES</h1>
                  <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:0.05em;">NUEVA COTIZACIÓN</p>
                </div>

                <!-- Badge tipo evento -->
                <div style="padding:24px 32px 0;text-align:center;">
                  <span style="display:inline-block;background:linear-gradient(135deg,#4a7aff,#a855f7);color:#fff;font-size:13px;font-weight:700;padding:6px 20px;border-radius:20px;letter-spacing:0.03em;">${tipoLabel}</span>
                </div>

                <!-- Datos -->
                <div style="padding:24px 32px;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:14px 12px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);width:140px;">Nombre</td>
                      <td style="padding:14px 12px;font-size:15px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${body.nombre}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 12px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);width:140px;">Email</td>
                      <td style="padding:14px 12px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.06);"><a href="mailto:${body.email}" style="color:#4a7aff;text-decoration:none;">${body.email}</a></td>
                    </tr>
                    <tr>
                      <td style="padding:14px 12px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);width:140px;">Fecha del Evento</td>
                      <td style="padding:14px 12px;font-size:15px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">📅 ${fechaFormateada}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 12px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.06);width:140px;vertical-align:top;">Mensaje</td>
                      <td style="padding:14px 12px;font-size:15px;color:rgba(255,255,255,0.8);border-bottom:1px solid rgba(255,255,255,0.06);line-height:1.6;">${body.mensaje}</td>
                    </tr>
                  </table>
                </div>

                <!-- Footer -->
                <div style="padding:16px 32px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.25);">Solicitud recibida el ${new Date().toLocaleDateString('es-CL')} · subsonicproducciones.cl</p>
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
