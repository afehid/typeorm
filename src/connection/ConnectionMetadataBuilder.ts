import {
    importClassesFromDirectories,
    importClassesFromDirectoriesWithPaths,
} from "../util/DirectoryExportedClassesLoader"
import { OrmUtils } from "../util/OrmUtils"
import type { MigrationInterface } from "../migration/MigrationInterface"
import { getMetadataArgsStorage } from "../globals"
import { EntityMetadataBuilder } from "../metadata-builder/EntityMetadataBuilder"
import { EntitySchemaTransformer } from "../entity-schema/EntitySchemaTransformer"
import type { DataSource } from "../data-source/DataSource"
import type { EntitySchema } from "../entity-schema/EntitySchema"
import type { EntityMetadata } from "../metadata/EntityMetadata"
import type { EntitySubscriberInterface } from "../subscriber/EntitySubscriberInterface"
import { InstanceChecker } from "../util/InstanceChecker"
import { attachMigrationSourcePath } from "../migration/MigrationSource"

/**
 * Builds migration instances, subscriber instances and entity metadatas for the given classes.
 */
export class ConnectionMetadataBuilder {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(protected dataSource: DataSource) {}

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Builds migration instances for the given classes or directories.
     *
     * @param migrations
     */
    async buildMigrations(
        migrations: (Function | string)[],
    ): Promise<MigrationInterface[]> {
        const [migrationClasses, migrationDirectories] =
            OrmUtils.splitClassesAndStrings(migrations)
        const fromDirectories = await importClassesFromDirectoriesWithPaths(
            this.dataSource.logger,
            migrationDirectories,
        )
        // Attach the source file path only to migration classes so checksum
        // computation can hash stable file contents.  Other class types (entities,
        // subscribers) are loaded via the plain importClassesFromDirectories
        // helper and are never mutated here.
        for (const { cls, filePath } of fromDirectories) {
            if (filePath) {
                try {
                    attachMigrationSourcePath(cls, filePath)
                } catch (e) {
                    if (!(e instanceof TypeError)) throw e
                    // Non-extensible/sealed exports: silently skip; checksum
                    // falls back to Function.toString() for those classes.
                }
            }
        }
        const allMigrationClasses = [
            ...migrationClasses,
            ...fromDirectories.map((p) => p.cls),
        ]
        return allMigrationClasses.map(
            (migrationClass) =>
                new (migrationClass as new () => MigrationInterface)(),
        )
    }

    /**
     * Builds subscriber instances for the given classes or directories.
     *
     * @param subscribers
     */
    async buildSubscribers(
        subscribers: (Function | string)[],
    ): Promise<EntitySubscriberInterface<any>[]> {
        const [subscriberClasses, subscriberDirectories] =
            OrmUtils.splitClassesAndStrings(subscribers || [])
        const allSubscriberClasses = [
            ...subscriberClasses,
            ...(await importClassesFromDirectories(
                this.dataSource.logger,
                subscriberDirectories,
            )),
        ]
        return getMetadataArgsStorage()
            .filterSubscribers(allSubscriberClasses)
            .map(
                (metadata) =>
                    new (
                        metadata.target as new () => EntitySubscriberInterface<any>
                    )(),
            )
    }

    /**
     * Builds entity metadatas for the given classes or directories.
     *
     * @param entities
     */
    async buildEntityMetadatas(
        entities: (Function | EntitySchema<any> | string)[],
    ): Promise<EntityMetadata[]> {
        // todo: instead we need to merge multiple metadata args storages

        const [entityClassesOrSchemas, entityDirectories] =
            OrmUtils.splitClassesAndStrings(entities || [])
        const entityClasses: Function[] = entityClassesOrSchemas.filter(
            (entityClass) => !InstanceChecker.isEntitySchema(entityClass),
        ) as any
        const entitySchemas: EntitySchema<any>[] =
            entityClassesOrSchemas.filter((entityClass) =>
                InstanceChecker.isEntitySchema(entityClass),
            ) as any

        const allEntityClasses = [
            ...entityClasses,
            ...(await importClassesFromDirectories(
                this.dataSource.logger,
                entityDirectories,
            )),
        ]
        allEntityClasses.forEach((entityClass) => {
            // if we have entity schemas loaded from directories
            if (InstanceChecker.isEntitySchema(entityClass)) {
                entitySchemas.push(entityClass)
            }
        })
        const decoratorEntityMetadatas = new EntityMetadataBuilder(
            this.dataSource,
            getMetadataArgsStorage(),
        ).build(allEntityClasses)

        const metadataArgsStorageFromSchema =
            new EntitySchemaTransformer().transform(entitySchemas)
        const schemaEntityMetadatas = new EntityMetadataBuilder(
            this.dataSource,
            metadataArgsStorageFromSchema,
        ).build()

        return [...decoratorEntityMetadatas, ...schemaEntityMetadatas]
    }
}
