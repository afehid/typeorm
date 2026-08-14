import { TypeORMError } from "./TypeORMError"

/**
 * Thrown when an already-executed migration's source no longer matches
 * the checksum stored in the migrations table.
 */
export class MigrationChecksumMismatchError extends TypeORMError {
    constructor(migrationName: string) {
        super(
            `Migration "${migrationName}" checksum mismatch. The migration source changed after it was executed. Set migrationsChecksumCheck to false to skip this check.`,
        )
    }
}
