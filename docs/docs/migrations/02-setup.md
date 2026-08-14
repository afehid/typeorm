# Setup

Before working with migrations you need to setup your [DataSource](../data-source/1-data-source.md) options properly:

```ts
export default new DataSource({
    // basic setup
    synchronize: false,
    migrations: [__dirname + "/migrations/**/*{.js,.ts}"],

    // optional
    migrationsRun: false,
    migrationsTableName: "migrations",
    migrationsTransactionMode: "all",
    migrationsChecksumCheck: false,
    // migrationsExtraColumns: [{ name: "executedBy", type: "varchar", length: "255" }],

    // other options...
})
```

## `synchronise`

Turning off automatic schema synchronisation is essential for working with migrations. Otherwise they would make no sense.

## `migrations`

Defines list of migrations that need to be loaded by TypeORM. It accepts both migration classes and directories from which to load.

The easiest is to specify the directory where your migration files are located (glob patterns are supported):

```ts
migrations: [__dirname + "/migrations/**/*{.js,.ts}"]
```

Defining both `.js` and `.ts` extensions would allow you to run migrations in development and from compiled to JavaScript for production (eg. from Docker image).

Alternatively you could also specify exact classes to get more fine grained control:

```ts
import FirstMigration from "./migrations/TIMESTAMP-first-migration"
import SecondMigration from "./migrations/TIMESTAMP-second-migration"

export default new DataSource({
    migrations: [FirstMigration, SecondMigration],
})
```

but it also requires more manual work and can be error prone.

- `migrationsRun` - Indicates if [migrations](../migrations/01-why.md) should be auto-run on every application launch.

## Optional settings

### `migrationsRun`

Indicates if migrations should be auto-run on every application launch. Default: `false`

### `migrationsTableName`

You might want to specify the name of the table that will store information about executed migrations. By default it is called `'migrations'`.

```ts
migrationsTableName: "some_custom_migrations_table"
```

### `migrationsTransactionMode`

Controls transaction mode when running migrations. Possible options are:

- `all` (_default_) - wraps migrations run into a single transaction
- `none`
- `each`

### `migrationsChecksumCheck`

When enabled, TypeORM verifies that each already-executed migration still matches the checksum stored in the migrations table. If a stored checksum no longer matches, a `MigrationChecksumMismatchError` is thrown before further migrations run.

Each checksum is computed from that migration's name and a normalized `Function.toString()` of its `up` / `down` methods (not the whole file), so edits to other classes in the same file do not affect it.

Important: keep the artifact form consistent. Running migrations from `.ts` in development and compiled `.js` in production produces different checksums. For checksum verification, load the same form everywhere (typically compiled `.js`).

If the migrations table already has `executedAt` / `checksum` columns with incompatible types, TypeORM does not alter them — only missing columns are added.

Default: `false` (checksums are still stored when migrations execute; verification is opt-in).

```ts
migrationsChecksumCheck: true
```

### `migrationsExtraColumns`

Declares additional nullable columns on the migrations table for custom metadata. Values are taken from `MigrationInterface.migrationMetadata` when a migration is recorded.

Reserved column names (`id`, `timestamp`, `name`, `executedAt`, `checksum`) are ignored.

```ts
migrationsExtraColumns: [{ name: "executedBy", type: "varchar", length: "255" }]
```

```ts
export class CreatePost1730000000001 implements MigrationInterface {
    migrationMetadata = { executedBy: "ci" }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ...
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ...
    }
}
```
