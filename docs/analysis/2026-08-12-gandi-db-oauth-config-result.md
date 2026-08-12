# Gandi DB And OAuth Config Result

Date: 2026-08-12

Status: Safe diagnostic fix added. Production admin config action still required.

## Diagnosis

The reported `/auth/error` page is the app's OAuth failure route, not a generic Gandi error page.

The log line:

```text
[SQL ERROR] Access denied for user 'hosting-db'@'localhost' (using password: NO) SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1
```

means the OAuth callback reached app code, then failed during a DB-backed auth lookup. OAuth callbacks need DB reads/writes to resolve or create users, so a DB connection/auth failure can redirect the browser to `/auth/error`.

The repo default for this MySQL app is Gandi socket access with:

- `DB_SOCKET_PATH=/srv/run/mysqld/mysqld.sock`
- `DB_USER=root`
- `DB_PASSWORD=''` unless a real MySQL user/password was created
- `DB_NAME=stage_league` only if that database exists

`DB_USER=hosting-db` is a PostgreSQL-style default from Gandi examples and is not the correct default for this app's MySQL socket setup.

## Files Changed

- `server/src/server/db/database.js`
  - Preserves Gandi socket mode and local/staging TCP mode.
  - Adds a narrow fail-fast diagnostic for `DB_SOCKET_PATH=/srv/run/mysqld/mysqld.sock` with `DB_USER=hosting-db`.
  - Does not block valid custom MySQL users.

- `server/src/server/db/__tests__/databaseConfig.test.js`
  - Adds regression coverage for the known-bad Gandi `hosting-db` configuration.

- `server/src/constants/env.js`
  - Removed the committed SMTP password default.
  - SMTP password must come from `env.local.js` or host env.

## Gandi Admin Checklist

1. Remove or override this wrong value:

```text
DB_USER=hosting-db
```

2. Set the MySQL socket path:

```text
DB_SOCKET_PATH=/srv/run/mysqld/mysqld.sock
```

3. Set the MySQL user:

```text
DB_USER=root
```

Use a different value only if a real MySQL user was created for this database.

4. Set the MySQL password:

```text
DB_PASSWORD=
```

Leave it empty for the default Gandi root socket setup, or use the actual password for the custom MySQL user.

5. Confirm the database name:

```text
DB_NAME=stage_league
```

Only use `stage_league` if that database exists. Otherwise create/import `stage_league`, or temporarily set `DB_NAME` to the existing Gandi database name such as `default_db`.

6. Ensure OAuth callback URLs exactly match each provider:

```text
https://stageleagues.com/api/stage/auth/google/callback
https://stageleagues.com/api/stage/auth/microsoft/callback
https://stageleagues.com/api/stage/auth/twitch/callback
https://stageleagues.com/api/stage/auth/kick/callback
```

7. Ensure OAuth client secrets exist in one safe place:

- `server/src/constants/env.local.js` on the host, or
- Gandi host environment variables.

Do not commit OAuth secrets.

8. Upload changed backend files by FTP/SFTP.

9. Restart the Node app from the Gandi admin panel. FTP/SFTP upload alone does not restart the app.

10. Check logs after restart:

```text
/lamp0/var/log/www/nodejs.log
/lamp0/var/log/www/nodejs-watchd.log
```

Expected bad-config diagnostic if the wrong DB user remains:

```text
[db-config] Invalid Gandi MySQL configuration: DB_USER=hosting-db is a PostgreSQL-style default.
```

## SMTP Secret Action

`SMTP_PASS` was present in tracked config and has been removed from `env.js`.

Required user/admin action:

- Rotate the SMTP mailbox password.
- Put the new SMTP password only in `server/src/constants/env.local.js` on the host or in Gandi host env.
- Do not commit it.

## Verification

Commands run:

```bash
node --test server/src/server/db/__tests__/databaseConfig.test.js
node --check server/src/constants/env.js
node --check server/src/server/db/database.js
node --check server/src/server.js
```

Results:

- Focused DB config tests: passed, 3/3.
- `node --check server/src/constants/env.js`: passed.
- `node --check server/src/server/db/database.js`: passed.
- `node --check server/src/server.js`: passed.

## Remaining User Action

Fix the Gandi production environment so the app does not receive `DB_USER=hosting-db`, restart the Node app in the Gandi panel, and then retry OAuth.

Production testing was not performed from this task because it was not explicitly approved.
