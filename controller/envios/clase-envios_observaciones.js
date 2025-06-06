const { getConnection, getFromRedis, executeQuery } = require('../../dbconfig');
const { logYellow, logBlue } = require('../../fuctions/logsCustom');

// Crear la clase
class EnviosObservaciones {
    constructor(didEnvio = "", observacion = "", quien = "", desde = "", company = null, connection = null) {
        this.didEnvio = didEnvio;
        this.observacion = observacion || "efectivamente la observacion default de light data"; // Valor por defecto si observacion es null
        this.quien = quien || 0; // Valor por defecto para quien
        this.desde = desde;

        this.company = company;
        this.connection = connection
        // Asegurarse de que idEmpresa sea siempre un string
    }

    // Método para convertir a JSON
    toJSON() {
        return JSON.stringify(this);
    }

    // Método para insertar en la base de datos
    async insert() {
        try {
            if (this.didEnvio === null || this.didEnvio === undefined || this.didEnvio === "" || this.didEnvio === 0) {
                // Si `didEnvio` es null, crear un nuevo registro
                return this.createNewRecord(this.connection);
            } else {
                // Si `didEnvio` no es null, verificar si ya existe y manejarlo
                return this.checkAndUpdateDidEnvio(this.connection);
            }
        } catch (error) {
            console.error("Error en el método insert:", error.message);

            // Lanzar un error con el formato estándar
            throw {
                status: 500,
                response: {
                    estado: false,
                    error: -1,
                },
            };
        }
    }

    async checkAndUpdateDidEnvio(connection) {
        try {
            const checkDidEnvioQuery = 'SELECT id FROM envios_observaciones WHERE didEnvio = ?';
            const results = await executeQuery(connection, checkDidEnvioQuery, [this.didEnvio]);

            if (results.length > 0) {
                // Si `didEnvio` ya existe, actualizarlo
                const updateQuery = 'UPDATE envios_observaciones SET superado = 1 WHERE didEnvio = ?';
                await executeQuery(connection, updateQuery, [this.didEnvio]);

                // Crear un nuevo registro con el mismo `didEnvio`
                return this.createNewRecord(connection);
            } else {
                // Si `didEnvio` no existe, crear un nuevo registro directamente
                return this.createNewRecord(connection);
            }
        } catch (error) {
            throw error;
        }
    }

    async createNewRecord(connection) {
        try {
            const columnsQuery = 'DESCRIBE envios_observaciones';
            const results = await executeQuery(connection, columnsQuery, []);

            const tableColumns = results.map((column) => column.Field);
            const filteredColumns = tableColumns.filter((column) => this[column] !== undefined);

            const values = filteredColumns.map((column) => this[column]);
            const insertQuery = `INSERT INTO envios_observaciones (${filteredColumns.join(', ')}) VALUES (${filteredColumns.map(() => '?').join(', ')})`;

            logYellow("Insert Query", insertQuery);
            logBlue("Values:", values);

            const insertResult = await executeQuery(connection, insertQuery, values);
            return { insertId: insertResult.insertId };
        } catch (error) {
            throw error;
        }
    }

}

module.exports = EnviosObservaciones;
