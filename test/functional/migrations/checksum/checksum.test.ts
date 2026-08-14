import { expect } from "chai"
import "reflect-metadata"

import type { DataSource } from "../../../../src"
import { Migration, MigrationExecutor, Table } from "../../../../src"
import { MigrationChecksumMismatchError } from "../../../../src/error/MigrationChecksumMismatchError"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { CreatePost1730000000001 } from "./migration/1730000000001-CreatePost"

describe("migrations > checksum and executedAt metadata", () => {
    let dataSources: DataSource[]

    before(async () => {
        dataSources = await createTestingConnections({
            disabledDrivers: ["mongodb", "spanner"],
            dropSchema: true,
            schemaCreate: false,
            migrations: [__dirname + "/migration/*{.ts,.js}"],
        })
    })
    beforeEach(() => reloadTestingDatabases(dataSources))
    after(() => closeTestingConnections(dataSources))

    async function createLegacyMigrationsTable(
        dataSource: DataSource,
    ): Promise<string> {
        const queryRunner = dataSource.createQueryRunner()
        const migrationsTable = dataSource.driver.buildTableName(
            dataSource.options.migrationsTableName ?? "migrations",
            dataSource.driver.schema,
            dataSource.driver.database,
        )

        if (await queryRunner.hasTable(migrationsTable)) {
            await queryRunner.dropTable(migrationsTable)
        }

        await queryRunner.createTable(
            new Table({
                name: migrationsTable,
                columns: [
                    {
                        name: "id",
                        type: dataSource.driver.normalizeType({
                            type: dataSource.driver.mappedDataTypes.migrationId,
                        }),
                        isGenerated: true,
                        generationStrategy: "increment",
                        isPrimary: true,
                        isNullable: false,
                    },
                    {
                        name: "timestamp",
                        type: dataSource.driver.normalizeType({
                            type: dataSource.driver.mappedDataTypes
                                .migrationTimestamp,
                        }),
                        isNullable: false,
                    },
                    {
                        name: "name",
                        type: dataSource.driver.normalizeType({
                            type: dataSource.driver.mappedDataTypes
                                .migrationName,
                        }),
                        isNullable: false,
                    },
                ],
            }),
        )
        await queryRunner.release()
        return migrationsTable
    }

    it("stores executedAt and checksum when a migration runs", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                const before = Date.now()
                await dataSource.runMigrations({ transaction: "none" })
                const after = Date.now()

                const rows: Array<Record<string, any>> = await dataSource.query(
                    `SELECT * FROM ${dataSource.driver.escape("migrations")}`,
                )

                expect(rows).to.have.lengthOf(1)
                const checksum = rows[0].checksum ?? rows[0].CHECKSUM
                expect(checksum).to.match(/^[a-f0-9]{40}$/)
                const executedAt = Number(
                    rows[0].executedAt ?? rows[0].executedat,
                )
                expect(executedAt).to.be.at.least(before)
                expect(executedAt).to.be.at.most(after)
            }),
        ))

    it("adds missing columns on an existing migrations table", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                const migrationsTable =
                    await createLegacyMigrationsTable(dataSource)

                await dataSource.runMigrations({ transaction: "none" })

                const inspectRunner = dataSource.createQueryRunner()
                const table = await inspectRunner.getTable(migrationsTable)
                await inspectRunner.release()
                expect(table?.findColumnByName("executedAt")).to.not.equal(
                    undefined,
                )
                expect(table?.findColumnByName("checksum")).to.not.equal(
                    undefined,
                )
            }),
        ))

    it("upgrades a legacy migrations table when insertMigration is used directly", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                const migrationsTable =
                    await createLegacyMigrationsTable(dataSource)

                const instance = new CreatePost1730000000001()
                const migration = new Migration(
                    undefined,
                    1730000000001,
                    "CreatePost1730000000001",
                    instance,
                )
                const executor = new MigrationExecutor(dataSource)
                await executor.insertMigration(migration)

                const inspectRunner = dataSource.createQueryRunner()
                const table = await inspectRunner.getTable(migrationsTable)
                await inspectRunner.release()
                expect(table?.findColumnByName("executedAt")).to.not.equal(
                    undefined,
                )
                expect(table?.findColumnByName("checksum")).to.not.equal(
                    undefined,
                )

                const rows: Array<Record<string, any>> = await dataSource.query(
                    `SELECT * FROM ${dataSource.driver.escape("migrations")}`,
                )
                expect(rows).to.have.lengthOf(1)
                expect(rows[0].checksum ?? rows[0].CHECKSUM).to.match(
                    /^[a-f0-9]{40}$/,
                )
            }),
        ))

    it("does not fail checksum check by default when source still matches", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                await dataSource.runMigrations({ transaction: "none" })
                await dataSource.runMigrations({ transaction: "none" })
            }),
        ))

    it("throws when checksum check is enabled and a stored checksum no longer matches", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                await dataSource.runMigrations({ transaction: "none" })

                const fakeChecksum = "a".repeat(40)
                await dataSource.query(
                    `UPDATE ${dataSource.driver.escape(
                        "migrations",
                    )} SET ${dataSource.driver.escape(
                        "checksum",
                    )} = '${fakeChecksum}'`,
                )

                ;(
                    dataSource.options as { migrationsChecksumCheck?: boolean }
                ).migrationsChecksumCheck = true

                await expect(
                    dataSource.runMigrations({ transaction: "none" }),
                ).to.be.rejectedWith(MigrationChecksumMismatchError)
            }),
        ))
})
