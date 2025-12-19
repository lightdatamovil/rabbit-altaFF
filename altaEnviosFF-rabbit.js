const amqp = require("amqplib");
const { getCompanyById, getConnection } = require("./dbconfig");
const { AltaEnvio } = require("./controllerAlta/controllerAltaEnvio");
const { TTLDeduper } = require("./fuctions/ttlDedyper");
// Back-pressure
const PREFETCH = 5;
const RATE_LIMIT_PER_SEC = 500;

// Rate limiter simple
class RateLimiter {
  constructor(rps) {
    this.capacity = rps;
    this.tokens = rps;
    setInterval(() => {
      this.tokens = this.capacity;
    }, 1000).unref();
  }
  async take() {
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
    return this.take();
  }
}
const limiter = new RateLimiter(RATE_LIMIT_PER_SEC);

// ---- DEDUPE EN MEMORIA (10s) ----
const deduper = new TTLDeduper({ ttlMs: 10_000 }); // 10 segundos
const makeKey = (payload) => {
  const v = payload?.data?.ml_vendedor_id ?? "";
  const s = payload?.data?.ml_shipment_id ?? "";
  return `${v}:${s}`; // clave compuesta
};


async function startConsumer() {
  let connection, channel;

  try {
    connection = await amqp.connect(
      "amqp://lightdata:QQyfVBKRbw6fBb@158.69.131.226:5672"
    );
    channel = await connection.createChannel();

    const queue = "insertFF";
    await channel.assertQueue(queue, { durable: true });

    // ✅ Sets prolijos

    const empresasPermitidas = new Set([97, 130, 20, 175, 133, 103]);    // IDs a procesar

    console.log("Esperando mensajes en la cola:", queue);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());
          const idEmpresa = Number(data?.data?.didEmpresa);


          const key = makeKey(data);
          if (deduper.seen(key)) {
            console.log(`Descartado por duplicado reciente (TTL) key=${key}`);
            channel.ack(msg); // IMPORTANTÍSIMO: ack para que no vuelva a la cola
            return;
          }
          if (empresasPermitidas.has(idEmpresa)) {
            console.log(`Procesando mensaje para idEmpresa ${idEmpresa}:`, data);

            // const connectionDb = await getConnection(idEmpresa);
            const company = await getCompanyById(idEmpresa);
            // console.log(company, "company");

            await AltaEnvio(company, data);

            channel.ack(msg);
          } else {
            // console.log(`Mensaje con idEmpresa ${idEmpresa} recibido pero no procesado.`);
            channel.ack(msg);
          }
        } catch (error) {
          console.error("Error procesando el mensaje:", error);

        }
      }
    });
  } catch (error) {
    console.error("Error en el consumidor de RabbitMQ:", error);
  }
}

startConsumer();
