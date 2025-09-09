const amqp = require("amqplib");
const { getCompanyById, getConnection } = require("./dbconfig");
const { AltaEnvio } = require("./controllerAlta/controllerAltaEnvio");

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

    const empresasPermitidas = new Set([97, 130, 20]);    // IDs a procesar

    console.log("Esperando mensajes en la cola:", queue);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());
          const idEmpresa = Number(data?.data?.didEmpresa);



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
          channel.nack(msg);
        }
      }
    });
  } catch (error) {
    console.error("Error en el consumidor de RabbitMQ:", error);
  }
}

startConsumer();
