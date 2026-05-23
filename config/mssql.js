import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_HOST,
    database: process.env.MSSQL_DATABASE,
    port: parseInt(process.env.MSSQL_PORT) || 1433,
    options: {
        encrypt: process.env.MSSQL_ENCRYPT === 'true',
        trustServerCertificate: true, 
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

export const getMssqlConnection = async () => {

    if (pool) return pool;
    try {
        pool = await new sql.ConnectionPool(config).connect();
        console.log('Successfully connected to MSSQL Database');
        return pool;
    } catch (err) {
        console.error('MSSQL Connection Pool creation failed:', err.message);
        pool = null;
        throw err;
    }
};

export { sql };