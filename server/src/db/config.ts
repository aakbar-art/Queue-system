export function isSqlSnapshotEnabled(): boolean {
  const server = process.env.SQL_SERVER?.trim();
  const database = process.env.SQL_DATABASE?.trim();
  return Boolean(server && database);
}

export function sqlConnectionOptions(): {
  server: string;
  database: string;
  user?: string;
  password?: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort?: boolean;
  };
  pool?: { max: number; min: number; idleTimeoutMillis: number };
} {
  const server = process.env.SQL_SERVER!.trim();
  const database = process.env.SQL_DATABASE!.trim();
  const user = process.env.SQL_USER?.trim();
  const password = process.env.SQL_PASSWORD ?? "";
  const encrypt = process.env.SQL_ENCRYPT !== "false";
  const trustServerCertificate = process.env.SQL_TRUST_CERT !== "false";

  return {
    server,
    database,
    user: user || undefined,
    password: user ? password : undefined,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}
