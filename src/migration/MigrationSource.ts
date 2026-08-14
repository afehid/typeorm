import { PlatformTools } from "../platform/PlatformTools"

/**
 * Builds a SHA-1 checksum for a single migration from its name and the
 * normalized source of its `up` / `down` methods.
 *
 * This is intentionally scoped to the migration instance (not the whole file)
 * so that editing another class in the same file cannot invalidate an
 * already-executed migration's checksum.
 *
 * Checksums are only comparable when the same artifact form is used (.ts vs
 * compiled .js produce different Function.toString() output). Keep
 * `migrationsChecksumCheck` environments consistent (typically always `.js`).
 *
 * @param name
 * @param instance
 * @param instance.up
 * @param instance.down
 */
export function computeMigrationChecksum(
    name: string,
    instance?: {
        up?: (...args: any[]) => any
        down?: (...args: any[]) => any
    },
): string {
    const up = normalizeFunctionSource(instance?.up?.toString() ?? "")
    const down = normalizeFunctionSource(instance?.down?.toString() ?? "")
    return PlatformTools.sha1(`${name}\0${up}\0${down}`)
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
