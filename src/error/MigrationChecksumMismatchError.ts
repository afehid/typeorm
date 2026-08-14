import { TypeORMError } from "./TypeORMError"

/**
 * Thrown when an already-executed migration's source no longer matches
 * the checksum stored in the migrations table.
 */
export class MigrationChecksumMismatchError extends TypeORMError {
    readonly migrationName: string
    readonly storedChecksum: string
    readonly currentChecksum: string

    constructor(
        migrationName: string,
        storedChecksum: string,
        currentChecksum: string,
    ) {
        super(
            `Migration "${migrationName}" checksum mismatch (stored: ${storedChecksum}, current: ${currentChecksum}). The migration source changed after it was executed. Set migrationsChecksumCheck to false to skip this check.`,
        )
        this.migrationName = migrationName
        this.storedChecksum = storedChecksum
        this.currentChecksum = currentChecksum
    }
}
