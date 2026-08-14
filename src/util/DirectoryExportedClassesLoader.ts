import { globSync } from "tinyglobby"
import type { Logger } from "../logger/Logger"
import { PlatformTools } from "../platform/PlatformTools"
import { importOrRequireFile } from "./ImportUtils"
import { InstanceChecker } from "./InstanceChecker"
import { ObjectUtils } from "./ObjectUtils"

/**
 * Loads all exported classes from the given directory.
 *
 * @param logger
 * @param directories
 * @param formats
 */
export async function importClassesFromDirectories(
    logger: Logger,
    directories: string[],
    formats = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"],
): Promise<Function[]> {
    const pairs = await importClassesFromDirectoriesWithPaths(
        logger,
        directories,
        formats,
    )
    return pairs.map((p) => p.cls)
}

/**
 * Like {@link importClassesFromDirectories} but also returns the resolved file
 * path each *function* class was loaded from.  EntitySchema entries are included
 * with `filePath: undefined` so entity discovery is not broken.
 *
 * Used by the migration loader to attach stable file-path metadata for checksum
 * computation without mutating classes loaded for other purposes (entities,
 * subscribers).
 *
 * @param logger
 * @param directories
 * @param formats
 */
export async function importClassesFromDirectoriesWithPaths(
    logger: Logger,
    directories: string[],
    formats = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"],
): Promise<{ cls: Function; filePath: string | undefined }[]> {
    const logLevel = "info"
    const classesNotFoundMessage =
        "No classes were found using the provided glob pattern: "
    const classesFoundMessage = "All classes found using provided glob pattern"

    /**
     *
     * @param exported
     * @param allLoaded
     * @param filePath
     */
    function loadFileClasses(
        exported: any,
        allLoaded: { cls: Function; filePath: string | undefined }[],
        filePath: string,
    ) {
        if (typeof exported === "function") {
            allLoaded.push({ cls: exported, filePath })
        } else if (InstanceChecker.isEntitySchema(exported)) {
            // EntitySchema objects are not Functions but are cast as such by
            // downstream consumers.  Preserve them without a file path.
            allLoaded.push({
                cls: exported as unknown as Function,
                filePath: undefined,
            })
        } else if (Array.isArray(exported)) {
            exported.forEach((value) =>
                loadFileClasses(value, allLoaded, filePath),
            )
        } else if (ObjectUtils.isObject(exported)) {
            Object.values(exported).forEach((value) =>
                loadFileClasses(value, allLoaded, filePath),
            )
        }
        return allLoaded
    }

    const allFiles = directories.reduce((allDirs, dir) => {
        return allDirs.concat(globSync(PlatformTools.pathNormalize(dir)))
    }, [] as string[])

    if (directories.length > 0 && allFiles.length === 0) {
        logger.log(logLevel, `${classesNotFoundMessage} "${directories}"`)
    } else if (allFiles.length > 0) {
        logger.log(
            logLevel,
            `${classesFoundMessage} "${directories}" : "${allFiles}"`,
        )
    }

    const dirPromises = allFiles
        .filter((file) => {
            const dtsExtension = file.slice(-5)
            return (
                formats.indexOf(PlatformTools.pathExtname(file)) !== -1 &&
                dtsExtension !== ".d.ts"
            )
        })
        .map(async (file) => {
            const filePath = PlatformTools.pathResolve(file)
            const [importOrRequireResult] = await importOrRequireFile(filePath)
            return { filePath, exported: importOrRequireResult }
        })

    const dirs = await Promise.all(dirPromises)
    const allLoaded: { cls: Function; filePath: string | undefined }[] = []
    for (const dir of dirs) {
        loadFileClasses(dir.exported, allLoaded, dir.filePath)
    }
    return allLoaded
}
