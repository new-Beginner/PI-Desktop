use super::{create_migration_backup, Connection, Context, Path, Result};

/// Account identity is separate from legacy manifest singleton identities.
/// No existing provider is implicitly adopted into a template.
pub(crate) const DDL: &str = r#"
CREATE TABLE IF NOT EXISTS provider_template_bindings (
  provider_id TEXT PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version = 1),
  definition_json TEXT NOT NULL
);
"#;

pub(crate) fn migrate(conn: &Connection, path: &Path) -> Result<()> {
    let backup = create_migration_backup(conn, path, 24)?;
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(DDL)?;
    tx.pragma_update(None, "user_version", 25i64)?;
    tx.commit().with_context(|| {
        format!(
            "commit schema v24 to v25 migration; backup {} remains",
            backup.display()
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::{db::Database, providers, secrets::SecretStore};
    use serde_json::json;

    #[test]
    fn template_migration_v24_preserves_existing_rows_credentials_and_has_no_implicit_adoption() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("pi.sqlite");
        let db = Database::open(&path).unwrap();
        let secrets = SecretStore::open(root.path()).unwrap();
        let input = serde_json::from_value(json!({"name":"Existing user","secretValue":"fixture-migration-key","models":[{"id":"old-model"}]})).unwrap();
        let before = providers::create_provider(&db, &secrets, input).unwrap();
        let mut legacy = before.clone();
        legacy.owner_plugin_id = Some("fixture.legacy".into());
        db.conn()
            .execute(
                "UPDATE providers SET owner_plugin_id='fixture.legacy' WHERE id=?1",
                [&before.id],
            )
            .unwrap();
        let config: String = db
            .conn()
            .query_row(
                "SELECT config_json FROM providers WHERE id=?1",
                [&before.id],
                |r| r.get(0),
            )
            .unwrap();
        db.conn()
            .execute_batch("DROP TABLE provider_template_bindings; PRAGMA user_version=24;")
            .unwrap();
        drop(db);
        let upgraded = Database::open(&path).unwrap();
        let after = providers::get_provider(&upgraded, &secrets, &before.id)
            .unwrap()
            .unwrap();
        assert_eq!(
            serde_json::to_value(after).unwrap(),
            serde_json::to_value(legacy).unwrap()
        );
        assert_eq!(
            upgraded
                .conn()
                .query_row(
                    "SELECT config_json FROM providers WHERE id=?1",
                    [&before.id],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            config
        );
        assert_eq!(
            upgraded
                .conn()
                .query_row("SELECT count(*) FROM provider_template_bindings", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            upgraded
                .conn()
                .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            25
        );
        assert_eq!(
            providers::get_secret_for_provider(&upgraded, &secrets, &before.id)
                .unwrap()
                .as_deref(),
            Some("fixture-migration-key")
        );
        assert!(upgraded
            .conn()
            .execute(
                "INSERT INTO provider_template_bindings VALUES(?1,'gateway',2,'{}')",
                [&before.id]
            )
            .is_err());
    }
}
