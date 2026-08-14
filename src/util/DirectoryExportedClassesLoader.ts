import { globSync } from "tinyglobby"
import type { Logger } from "../logger/Logger"
import { attachMigrationSourcePath } from "../migration/MigrationSource"
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
        allLoaded: Function[],
        filePath?: string,
    ) {
        if (
            typeof exported === "function" ||
            InstanceChecker.isEntitySchema(exported)
        ) {
            if (filePath && typeof exported === "function") {
                attachMigrationSourcePath(exported, filePath)
            }
            allLoaded.push(exported)
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
    const allLoaded: Function[] = []
    for (const dir of dirs) {
        loadFileClasses(dir.exported, allLoaded, dir.filePath)
    }
    return allLoaded
}
