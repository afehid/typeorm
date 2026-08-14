import { PlatformTools } from "../platform/PlatformTools"

/**
 * Attached to migration classes loaded from files so checksums can use file
 * contents instead of Function.toString() (which differs between .ts and .js).
 */
export const MIGRATION_SOURCE_PATH = Symbol.for("TypeORM#migrationSourcePath")

/**
 * Records the absolute path of the file a migration class was loaded from.
 *
 * @param migrationClass
 * @param filePath
 */
export function attachMigrationSourcePath(
    migrationClass: Function,
    filePath: string,
): void {
    Object.defineProperty(migrationClass, MIGRATION_SOURCE_PATH, {
        value: filePath,
        configurable: true,
    })
}

/**
 * Returns the source file path for a migration instance or class, if known.
 *
 * @param migration
 */
export function getMigrationSourcePath(
    migration: object | Function,
): string | undefined {
    const target =
        typeof migration === "function" ? migration : migration.constructor
    const path = Reflect.get(target, MIGRATION_SOURCE_PATH)
    return typeof path === "string" ? path : undefined
}

/**
 * Builds a SHA-1 checksum for a migration.
 *
 * Prefers hashing the migration source file (stable for a given artifact).
 * Falls back to normalized Function.toString() when no file path is available
 * (e.g. migrations registered as classes).
 *
 * Checksums are only comparable when the same artifact form is used (.ts vs
 * compiled .js produce different file contents and function sources).
 *
 * @param name
 * @param instance
 * @param instance.constructor
 * @param instance.up
 * @param instance.down
 */
export function computeMigrationChecksum(
    name: string,
    instance?: {
        constructor: Function
        up?: (...args: any[]) => any
        down?: (...args: any[]) => any
    },
): string {
    const sourcePath = instance ? getMigrationSourcePath(instance) : undefined

    if (sourcePath && PlatformTools.fileExist(sourcePath)) {
        const content = Buffer.from(
            PlatformTools.readFileSync(sourcePath),
        ).toString("utf8")
        const normalized = content
            .replace(/^\uFEFF/, "")
            .replaceAll("\r\n", "\n")
        return PlatformTools.sha1(`${name}\0file\0${normalized}`)
    }

    const up = normalizeFunctionSource(instance?.up?.toString() ?? "")
    const down = normalizeFunctionSource(instance?.down?.toString() ?? "")
    return PlatformTools.sha1(`${name}\0fn\0${up}\0${down}`)
}

/**
 * Collapses insignificant whitespace so minor formatter differences are less
 * likely to change Function.toString()-based checksums.
 *
 * @param source
 */
function normalizeFunctionSource(source: string): string {
    return source.replaceAll("\r\n", "\n").replaceAll(/\s+/g, " ").trim()
}
