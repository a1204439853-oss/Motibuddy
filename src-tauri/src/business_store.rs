//! One atomic, versioned commit for an account's tasks, pet, achievements and settings.
//! Credentials remain outside this store. Never infer an empty account from damaged files.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct BusinessData {
    pub tasks: Value,
    pub pet: Value,
    pub achievements: Value,
    pub settings: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub id: String,
    pub base_revision: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub schema_version: u32,
    pub user_id: String,
    pub revision: u64,
    pub data: BusinessData,
    pub operations: Vec<Receipt>,
}

pub struct BusinessStore {
    root: PathBuf,
    gate: Mutex<()>,
}
const MAX_REVISION: u64 = 9_007_199_254_740_991;
const MAX_BYTES: u64 = 64 * 1024 * 1024;

pub fn widget_projection(snapshot: &Snapshot) -> Value {
    let tasks: Vec<Value> = snapshot.data.tasks.as_array().unwrap().iter().map(|task| json!({
        "id": task["id"], "title": task["title"], "due_date": task["dueDate"], "priority": task["priority"], "status": task["status"]
    })).collect();
    let pet = &snapshot.data.pet;
    let pet = if pet.is_null() {
        Value::Null
    } else {
        json!({
            "name": pet["name"], "pet_type": pet["type"], "level": pet["level"], "health": pet["health"],
            "happiness": pet["happiness"], "hunger": pet["hunger"], "energy": pet["energy"]
        })
    };
    json!({ "user_id": snapshot.user_id, "tasks": tasks, "pet": pet, "revision": snapshot.revision, "timestamp": 0 })
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn require(value: bool) -> Result<(), String> {
    if value {
        Ok(())
    } else {
        Err("INVALID_BUSINESS_DATA: existing data has been preserved".into())
    }
}
fn date(value: &Value) -> bool {
    value
        .as_str()
        .map_or(false, |s| chrono::DateTime::parse_from_rfc3339(s).is_ok())
}
fn nonempty(value: &Value) -> bool {
    value.as_str().map_or(false, |s| !s.is_empty())
}
fn number(value: &Value, min: f64, max: f64) -> bool {
    value
        .as_f64()
        .map_or(false, |n| n.is_finite() && n >= min && n <= max)
}

pub fn validate_data(data: &BusinessData, owner: &str) -> Result<(), String> {
    require(valid_id(owner))?;
    let tasks = data.tasks.as_array().ok_or("INVALID_TASKS")?;
    let mut ids = HashSet::new();
    for task in tasks {
        require(nonempty(&task["id"]) && ids.insert(task["id"].as_str().unwrap()))?;
        require(nonempty(&task["title"]) && date(&task["dueDate"]) && date(&task["createdAt"]))?;
        require(
            ["low", "medium", "high", "urgent"].contains(&task["priority"].as_str().unwrap_or("")),
        )?;
        require(
            ["pending", "in-progress", "completed", "overdue"]
                .contains(&task["status"].as_str().unwrap_or("")),
        )?;
        if let Some(value) = task.get("completedAt") {
            require(date(value))?;
        }
        if let Some(value) = task.get("description") {
            require(value.is_string())?;
        }
        if let Some(value) = task.get("estimatedDuration") {
            require(number(value, 0.0, f64::MAX))?;
        }
        if let Some(reminders) = task.get("reminders") {
            for reminder in reminders.as_array().ok_or("INVALID_REMINDERS")? {
                require(date(&reminder["time"]) && reminder["sent"].is_boolean())?;
            }
        }
    }
    if !data.pet.is_null() {
        let pet = &data.pet;
        require(
            pet["userId"].as_str() == Some(owner) && nonempty(&pet["id"]) && nonempty(&pet["name"]),
        )?;
        require(["cat", "dog", "panda", "bird"].contains(&pet["type"].as_str().unwrap_or("")))?;
        require(
            pet["level"]
                .as_u64()
                .map_or(false, |n| n > 0 && n <= MAX_REVISION)
                && number(&pet["experience"], 0.0, MAX_REVISION as f64),
        )?;
        for key in ["health", "happiness", "hunger", "energy"] {
            require(number(&pet[key], 0.0, 100.0))?;
        }
        for key in ["lastFed", "lastInteraction", "createdAt"] {
            require(date(&pet[key]))?;
        }
        if let Some(receipts) = pet.get("taskRewardReceipts") {
            for receipt in receipts
                .as_object()
                .ok_or("INVALID_REWARD_RECEIPTS")?
                .values()
            {
                require(
                    receipt["version"] == 1
                        && date(&receipt["grantedAt"])
                        && number(&receipt["experience"], 0.0, MAX_REVISION as f64),
                )?;
                for key in ["health", "happiness", "hunger", "energy"] {
                    require(number(&receipt[key], -100.0, 100.0))?;
                }
            }
        }
    }
    let mut achievement_ids = HashSet::new();
    for achievement in data.achievements.as_array().ok_or("INVALID_ACHIEVEMENTS")? {
        require(
            nonempty(&achievement["id"])
                && achievement_ids.insert(achievement["id"].as_str().unwrap()),
        )?;
        for key in ["type", "name", "description", "icon"] {
            require(achievement[key].is_string())?;
        }
        require(date(&achievement["unlockedAt"]))?;
    }
    require(data.settings.is_object())?;
    if let Some(interactions) = data.settings.get("petInteractions") {
        require(interactions.is_object())?;
        for (count, start) in [
            ("feedCount2Hour", "feedWindowStart"),
            ("playCount2Hour", "playWindowStart"),
        ] {
            require(interactions[count].as_u64().map_or(false, |n| n <= 2))?;
            require(
                interactions
                    .get(start)
                    .map_or(false, |value| value.is_null() || date(value)),
            )?;
        }
    }
    Ok(())
}

fn validate_snapshot(snapshot: &Snapshot, owner: &str) -> Result<(), String> {
    require(
        snapshot.schema_version == 1
            && snapshot.user_id == owner
            && snapshot.revision > 0
            && snapshot.revision <= MAX_REVISION,
    )?;
    require(snapshot.operations.len() <= 128)?;
    let mut ids = HashSet::new();
    for operation in &snapshot.operations {
        require(
            valid_id(&operation.id)
                && ids.insert(&operation.id)
                && operation.base_revision < snapshot.revision,
        )?;
    }
    validate_data(&snapshot.data, owner)
}

fn read_text(path: &Path) -> Result<Option<String>, String> {
    if !crate::storage_paths::data_file_exists(path).map_err(|e| format!("READ_FAILED: {e}"))? {
        for suffix in [".bak", ".tmp", ".bak.tmp"] {
            if crate::storage_paths::data_file_exists(&sidecar(path, suffix))
                .map_err(|e| format!("READ_FAILED: {e}"))?
            {
                return Err("RECOVERY_REQUIRED: primary missing; recovery files preserved".into());
            }
        }
        return Ok(None);
    }
    require(
        fs::metadata(path)
            .map_err(|e| format!("READ_FAILED: {e}"))?
            .len()
            <= MAX_BYTES,
    )?;
    fs::read_to_string(path)
        .map(Some)
        .map_err(|e| format!("READ_FAILED: {e}"))
}
fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    name.into()
}
fn normalized_dates(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(normalized_dates).collect()),
        Value::Object(values) => Value::Object(
            values
                .iter()
                .map(|(key, value)| {
                    let normalized = if [
                        "dueDate",
                        "createdAt",
                        "completedAt",
                        "unlockedAt",
                        "lastInteraction",
                        "lastFed",
                        "time",
                        "adoptedAt",
                    ]
                    .contains(&key.as_str())
                    {
                        value
                            .as_str()
                            .and_then(|raw| chrono::DateTime::parse_from_rfc3339(raw).ok())
                            .map(|date| {
                                Value::String(
                                    date.with_timezone(&chrono::Utc)
                                        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                                )
                            })
                            .unwrap_or_else(|| normalized_dates(value))
                    } else {
                        normalized_dates(value)
                    };
                    (key.clone(), normalized)
                })
                .collect(),
        ),
        _ => value.clone(),
    }
}
fn synced_write(path: &Path, text: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)
        .map_err(|e| format!("WRITE_FAILED: {e}"))?;
    file.write_all(text.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("WRITE_FAILED: {e}"))
}

impl BusinessStore {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            gate: Mutex::new(()),
        }
    }
    fn path(&self, owner: &str) -> Result<PathBuf, String> {
        require(valid_id(owner))?;
        Ok(self.root.join(format!("business_{owner}.json")))
    }
    fn read_now(&self, owner: &str) -> Result<Option<Snapshot>, String> {
        read_text(&self.path(owner)?)?
            .map(|raw| {
                let snapshot: Snapshot =
                    serde_json::from_str(&raw).map_err(|_| "INVALID_BUSINESS_SNAPSHOT")?;
                validate_snapshot(&snapshot, owner)?;
                Ok(snapshot)
            })
            .transpose()
    }
    pub fn read(&self, owner: &str) -> Result<Option<Snapshot>, String> {
        let _guard = self.gate.lock().map_err(|_| "STORAGE_UNAVAILABLE")?;
        self.read_now(owner)
    }
    fn write_snapshot(
        &self,
        snapshot: &Snapshot,
        before_replace: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        validate_snapshot(snapshot, &snapshot.user_id)?;
        let path = self.path(&snapshot.user_id)?;
        fs::create_dir_all(&self.root).map_err(|e| format!("WRITE_FAILED: {e}"))?;
        let text = serde_json::to_string(snapshot).map_err(|_| "INVALID_BUSINESS_SNAPSHOT")?;
        require(text.len() as u64 <= MAX_BYTES)?;
        let previous = read_text(&path)?;
        let staged = sidecar(&path, ".tmp");
        synced_write(&staged, &text)?;
        let staged_snapshot: Snapshot =
            serde_json::from_str(&fs::read_to_string(&staged).map_err(|_| "STAGED_READ_FAILED")?)
                .map_err(|_| "STAGED_DATA_INVALID")?;
        require(staged_snapshot == *snapshot)?;
        if let Some(previous) = previous {
            let backup = sidecar(&path, ".bak.tmp");
            synced_write(&backup, &previous)?;
            require(fs::read_to_string(&backup).map_err(|_| "BACKUP_READ_FAILED")? == previous)?;
            fs::rename(&backup, sidecar(&path, ".bak"))
                .map_err(|e| format!("BACKUP_FAILED: {e}"))?;
        }
        before_replace()?;
        // A single replacement is the commit point. Never delete the primary to make it work.
        fs::rename(&staged, &path).map_err(|e| format!("COMMIT_FAILED: {e}"))?;
        Ok(())
    }
    pub fn initialize(&self, owner: &str, data: BusinessData) -> Result<Snapshot, String> {
        let _guard = self.gate.lock().map_err(|_| "STORAGE_UNAVAILABLE")?;
        if let Some(existing) = self.read_now(owner)? {
            return Ok(existing);
        }
        validate_data(&data, owner)?;
        for filename in ["tasks.json", "pet.json", "settings.json"] {
            if read_text(&self.root.join(filename))?.is_some() {
                return Err(
                    "UNASSIGNED_LEGACY_DATA: review shared files before account migration".into(),
                );
            }
        }
        // Preserve exact legacy bytes before adopting a new authority. No old files are deleted.
        let mut sources = serde_json::Map::new();
        for prefix in ["tasks_", "pet_", "settings_", "migration_pet_"] {
            let name = format!("{prefix}{owner}.json");
            sources.insert(
                name.clone(),
                read_text(&self.root.join(name))?
                    .map(Value::String)
                    .unwrap_or(Value::Null),
            );
        }
        // The seed must match the currently saved files, not a stale frontend read.
        for (prefix, value) in [
            ("tasks_", &data.tasks),
            ("pet_", &data.pet),
            ("settings_", &data.settings),
        ] {
            if let Some(raw) = sources[&format!("{prefix}{owner}.json")].as_str() {
                let parsed: Value = serde_json::from_str(raw).map_err(|_| "INVALID_LEGACY_DATA")?;
                require(normalized_dates(&parsed) == normalized_dates(value))?;
            } else {
                require(match prefix {
                    "tasks_" => value == &json!([]),
                    "pet_" => value.is_null(),
                    _ => value == &json!({}),
                })?;
            }
        }
        let archive =
            json!({ "schemaVersion": 1, "userId": owner, "sources": sources, "initialData": data });
        fs::create_dir_all(&self.root).map_err(|e| format!("WRITE_FAILED: {e}"))?;
        let archive_path = self.root.join(format!("migration_business_{owner}.json"));
        if let Some(raw) = read_text(&archive_path)? {
            require(
                serde_json::from_str::<Value>(&raw).map_err(|_| "INVALID_MIGRATION_ARCHIVE")?
                    == archive,
            )?;
        } else {
            // create_new avoids overwriting a prior interrupted migration's source archive.
            let text = serde_json::to_string(&archive).map_err(|_| "INVALID_MIGRATION_ARCHIVE")?;
            require(text.len() as u64 <= MAX_BYTES)?;
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&archive_path)
                .map_err(|e| format!("BACKUP_FAILED: {e}"))?;
            file.write_all(text.as_bytes())
                .and_then(|_| file.sync_all())
                .map_err(|e| format!("BACKUP_FAILED: {e}"))?;
        }
        let snapshot = Snapshot {
            schema_version: 1,
            user_id: owner.into(),
            revision: 1,
            data,
            operations: vec![],
        };
        self.write_snapshot(&snapshot, || Ok(()))?;
        Ok(snapshot)
    }
    pub fn commit(
        &self,
        owner: &str,
        expected: u64,
        operation_id: &str,
        data: BusinessData,
    ) -> Result<Snapshot, String> {
        let _guard = self.gate.lock().map_err(|_| "STORAGE_UNAVAILABLE")?;
        require(valid_id(operation_id))?;
        validate_data(&data, owner)?;
        let previous = self.read_now(owner)?.ok_or("ACCOUNT_NOT_INITIALIZED")?;
        if let Some(receipt) = previous
            .operations
            .iter()
            .find(|receipt| receipt.id == operation_id)
        {
            require(receipt.base_revision == expected)?;
            // If this is the most recent commit, detect an ID reused with different contents.
            if previous.revision == expected + 1 {
                require(previous.data == data)?;
            }
            return Ok(previous);
        }
        if previous.revision != expected {
            return Err("REVISION_CONFLICT: refresh before retrying".into());
        }
        require(expected < MAX_REVISION)?;
        let mut operations = previous.operations;
        operations.push(Receipt {
            id: operation_id.into(),
            base_revision: expected,
        });
        if operations.len() > 128 {
            operations.remove(0);
        }
        let next = Snapshot {
            schema_version: 1,
            user_id: owner.into(),
            revision: expected + 1,
            data,
            operations,
        };
        self.write_snapshot(&next, || Ok(()))?;
        Ok(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Directory(PathBuf);
    impl Directory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "motibuddy-business-test-{}-{}-{}",
                std::process::id(),
                chrono::Utc::now().timestamp_nanos_opt().unwrap(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn store(&self) -> BusinessStore {
            BusinessStore::new(self.0.clone())
        }
        fn legacy(&self, data: &BusinessData) {
            for (prefix, value) in [
                ("tasks_", &data.tasks),
                ("pet_", &data.pet),
                ("settings_", &data.settings),
            ] {
                fs::write(
                    self.0.join(format!("{prefix}A.json")),
                    serde_json::to_string(value).unwrap(),
                )
                .unwrap();
            }
        }
    }
    impl Drop for Directory {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            assert!(self
                .0
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("motibuddy-business-test-"));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    fn empty() -> BusinessData {
        BusinessData {
            tasks: json!([]),
            pet: Value::Null,
            achievements: json!([]),
            settings: json!({}),
        }
    }
    fn populated() -> BusinessData {
        BusinessData {
            tasks: json!([{ "id":"one", "title":"One", "status":"in-progress", "priority":"medium", "dueDate":"2026-10-16T00:00:00.000Z", "createdAt":"2026-10-15T00:00:00.000Z" }]),
            pet: json!({ "id":"pet", "userId":"A", "name":"Buddy", "type":"cat", "level":1, "experience":0, "health":70, "happiness":50, "hunger":80, "energy":80, "createdAt":"2026-10-15T00:00:00.000Z", "lastFed":"2026-10-15T00:00:00.000Z", "lastInteraction":"2026-10-15T00:00:00.000Z" }),
            achievements: json!([]),
            settings: json!({ "theme":"light" }),
        }
    }
    #[test]
    fn initialization_preserves_exact_legacy_sources_before_creating_authority() {
        let directory = Directory::new();
        let data = populated();
        directory.legacy(&data);
        let before = fs::read(directory.0.join("pet_A.json")).unwrap();
        let saved = directory.store().initialize("A", data.clone()).unwrap();
        let archive: Value = serde_json::from_str(
            &fs::read_to_string(directory.0.join("migration_business_A.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            archive["sources"]["pet_A.json"],
            String::from_utf8(before.clone()).unwrap()
        );
        assert_eq!(saved.data, data);
        assert_eq!(saved.revision, 1);
        assert_eq!(fs::read(directory.0.join("pet_A.json")).unwrap(), before);
    }
    #[test]
    fn new_empty_account_is_distinct_from_missing_authority_with_recovery_files() {
        let directory = Directory::new();
        let store = directory.store();
        assert_eq!(store.read("A").unwrap(), None);
        fs::write(directory.0.join("business_A.json.bak"), "{}").unwrap();
        assert!(store.read("A").unwrap_err().contains("RECOVERY_REQUIRED"));
        assert!(store.initialize("A", empty()).is_err());
    }
    #[test]
    fn all_business_records_commit_together_and_previous_snapshot_is_backed_up() {
        let directory = Directory::new();
        let store = directory.store();
        store.initialize("A", empty()).unwrap();
        let mut data = populated();
        data.tasks[0]["status"] = json!("completed");
        data.pet["experience"] = json!(10);
        data.achievements = json!([{ "id":"8", "type":"first_task", "name":"First", "description":"First", "icon":"flag", "unlockedAt":"2026-10-15T00:00:00Z" }]);
        data.settings["petInteractions"] = json!({ "feedCount2Hour":1, "playCount2Hour":0, "feedWindowStart":"2026-10-15T00:00:00Z", "playWindowStart":null });
        let next = store.commit("A", 1, "operation-one", data.clone()).unwrap();
        assert_eq!(next.data, data);
        assert_eq!(store.read("A").unwrap().unwrap(), next);
        let backup: Snapshot = serde_json::from_str(
            &fs::read_to_string(directory.0.join("business_A.json.bak")).unwrap(),
        )
        .unwrap();
        assert_eq!(backup.data, empty());
        assert_eq!(backup.revision, 1);
    }
    #[test]
    fn injected_failure_before_replacement_keeps_every_record_at_the_previous_revision() {
        let directory = Directory::new();
        let store = directory.store();
        let old = store.initialize("A", empty()).unwrap();
        let mut next = old.clone();
        next.revision = 2;
        next.data = populated();
        assert!(store
            .write_snapshot(&next, || Err("injected interruption".into()))
            .is_err());
        assert_eq!(store.read("A").unwrap().unwrap(), old);
        assert!(directory.0.join("business_A.json.tmp").is_file());
        assert_eq!(
            store.commit("A", 1, "retry", populated()).unwrap().revision,
            2
        );
    }
    #[test]
    fn backup_failure_blocks_commit_without_damaging_the_primary() {
        let directory = Directory::new();
        let store = directory.store();
        let old = store.initialize("A", empty()).unwrap();
        fs::create_dir(directory.0.join("business_A.json.bak.tmp")).unwrap();
        assert!(store.commit("A", 1, "write", populated()).is_err());
        assert_eq!(store.read("A").unwrap().unwrap(), old);
    }
    #[test]
    fn stage_failure_does_not_publish_success() {
        let directory = Directory::new();
        let store = directory.store();
        let old = store.initialize("A", empty()).unwrap();
        fs::create_dir(directory.0.join("business_A.json.tmp")).unwrap();
        assert!(store.commit("A", 1, "write", populated()).is_err());
        assert_eq!(store.read("A").unwrap().unwrap(), old);
    }
    #[test]
    fn corrupt_primary_never_falls_back_to_stale_files_or_overwrites_them() {
        let directory = Directory::new();
        let store = directory.store();
        store.initialize("A", empty()).unwrap();
        fs::write(directory.0.join("business_A.json"), "broken").unwrap();
        assert!(store.read("A").is_err());
        assert!(store.initialize("A", empty()).is_err());
        assert!(store.commit("A", 1, "write", populated()).is_err());
        assert_eq!(
            fs::read_to_string(directory.0.join("business_A.json")).unwrap(),
            "broken"
        );
    }
    #[test]
    fn stale_revision_cannot_replace_newer_progress() {
        let directory = Directory::new();
        let store = directory.store();
        store.initialize("A", empty()).unwrap();
        let current = store.commit("A", 1, "first", populated()).unwrap();
        assert!(store
            .commit("A", 1, "second", empty())
            .unwrap_err()
            .contains("REVISION_CONFLICT"));
        assert_eq!(store.read("A").unwrap().unwrap(), current);
    }
    #[test]
    fn receipt_survives_restart_and_duplicate_delivery_does_not_reapply() {
        let directory = Directory::new();
        directory.store().initialize("A", empty()).unwrap();
        let next = directory
            .store()
            .commit("A", 1, "request-one", populated())
            .unwrap();
        assert_eq!(
            directory
                .store()
                .commit("A", 1, "request-one", populated())
                .unwrap(),
            next
        );
        assert!(directory
            .store()
            .commit("A", 1, "request-one", empty())
            .is_err());
        assert!(directory
            .store()
            .commit("A", 2, "request-one", populated())
            .is_err());
    }
    #[test]
    fn receipt_history_is_bounded_and_evicted_stale_requests_still_fail_revision_check() {
        let directory = Directory::new();
        let store = directory.store();
        store.initialize("A", empty()).unwrap();
        for index in 1..=130 {
            store
                .commit("A", index, &format!("operation-{index}"), empty())
                .unwrap();
        }
        assert_eq!(store.read("A").unwrap().unwrap().operations.len(), 128);
        assert!(store
            .commit("A", 1, "operation-1", empty())
            .unwrap_err()
            .contains("REVISION_CONFLICT"));
    }
    #[test]
    fn concurrent_same_revision_writers_cannot_both_commit() {
        let directory = Directory::new();
        let store = Arc::new(directory.store());
        store.initialize("A", empty()).unwrap();
        let barrier = Arc::new(Barrier::new(3));
        let mut threads = vec![];
        for index in 0..2 {
            let store = store.clone();
            let barrier = barrier.clone();
            threads.push(std::thread::spawn(move || {
                barrier.wait();
                store.commit("A", 1, &format!("writer-{index}"), empty())
            }));
        }
        barrier.wait();
        let results: Vec<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(store.read("A").unwrap().unwrap().revision, 2);
    }
    #[test]
    fn invalid_owner_paths_and_invalid_business_fields_are_rejected() {
        let directory = Directory::new();
        let store = directory.store();
        for owner in ["../B", "", "A/B", "A:B"] {
            assert!(store.initialize(owner, empty()).is_err());
        }
        for key in ["health", "happiness", "energy", "hunger"] {
            let mut data = populated();
            data.pet[key] = json!(101);
            assert!(validate_data(&data, "A").is_err());
        }
        let mut data = populated();
        data.pet["userId"] = json!("B");
        assert!(validate_data(&data, "A").is_err());
        let mut data = populated();
        data.tasks[0]["dueDate"] = json!("not a date");
        assert!(validate_data(&data, "A").is_err());
        let mut data = populated();
        let duplicate = data.tasks[0].clone();
        data.tasks.as_array_mut().unwrap().push(duplicate);
        assert!(validate_data(&data, "A").is_err());
    }
    #[test]
    fn changed_legacy_input_or_existing_migration_archive_blocks_initialization() {
        let directory = Directory::new();
        let data = populated();
        directory.legacy(&data);
        assert!(directory.store().initialize("A", empty()).is_err());
        fs::write(directory.0.join("migration_business_A.json"), "{}").unwrap();
        assert!(directory.store().initialize("A", data).is_err());
        assert!(!directory.0.join("business_A.json").exists());
    }
    #[test]
    fn equivalent_date_offsets_do_not_create_a_false_migration_conflict() {
        let directory = Directory::new();
        let mut data = populated();
        let mut legacy = data.clone();
        legacy.tasks[0]["dueDate"] = json!("2026-10-16T08:00:00+08:00");
        directory.legacy(&legacy);
        data.tasks[0]["dueDate"] = json!("2026-10-16T00:00:00.000Z");
        assert!(directory.store().initialize("A", data).is_ok());
    }
    #[test]
    fn initialization_is_idempotent_and_never_reimports_retained_legacy_files() {
        let directory = Directory::new();
        let store = directory.store();
        let saved = store.initialize("A", empty()).unwrap();
        directory.legacy(&populated());
        assert_eq!(store.initialize("A", populated()).unwrap(), saved);
    }
    #[test]
    fn shared_legacy_files_are_never_silently_assigned_to_a_new_account() {
        let directory = Directory::new();
        fs::write(directory.0.join("tasks.json"), "[]").unwrap();
        assert!(directory
            .store()
            .initialize("A", empty())
            .unwrap_err()
            .contains("UNASSIGNED_LEGACY_DATA"));
        assert!(!directory.0.join("business_A.json").exists());
    }
    #[test]
    fn widget_tasks_and_pet_always_come_from_one_committed_revision() {
        let directory = Directory::new();
        let store = directory.store();
        store.initialize("A", empty()).unwrap();
        let mut data = populated();
        data.tasks[0]["status"] = json!("completed");
        data.pet["experience"] = json!(10);
        let saved = store.commit("A", 1, "complete", data).unwrap();
        let widget = widget_projection(&saved);
        assert_eq!(widget["revision"], 2);
        assert_eq!(widget["user_id"], "A");
        assert_eq!(widget["tasks"][0]["status"], "completed");
        assert_eq!(widget["pet"]["pet_type"], "cat");
        assert_eq!(widget["pet"]["health"], saved.data.pet["health"]);
        assert!(!directory.0.join("widget_data_A.json").exists());
    }
}
