import { PlatformTools } from "../platform/PlatformTools"

/**
 * Builds a SHA-256 checksum of generated SQL (Flyway/Liquibase-style),
 * not of JavaScript `Function.toString()` which varies across .ts/.js and bundlers.
 *
 * Line endings are normalized to `\n` so Windows and Unix produce the same hash.
 *
 * @param name
 * @param sqlStatements
 */
export function computeMigrationChecksum(
    name: string,
    sqlStatements: string[],
): string {
    const normalizedSql = sqlStatements
        .map((sql) => normalizeSql(sql))
        .filter((sql) => sql.length > 0)
        .join("\n")
    return PlatformTools.sha256(`${name}\0${normalizedSql}`)
}

/**
 * Normalizes generated SQL for a stable, cross-platform checksum.
 *
 * @param sql
 */
export function normalizeSql(sql: string): string {
    return sql.replaceAll("\r\n", "\n").trim()
}

/**
 * Serializes a SQL string plus its bound parameters for checksum input.
 *
 * @param query
 * @param parameters
 */
export function formatSqlForChecksum(
    query: string,
    parameters?: unknown,
): string {
    const sql = normalizeSql(query)
    if (parameters === undefined || parameters === null) {
        return sql
    }
    return `${sql}\0${JSON.stringify(parameters)}`
}
