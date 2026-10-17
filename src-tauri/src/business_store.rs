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
        if let Some(mode) = task.get("timingMode") {
            require(["deadline", "range"].contains(&mode.as_str().unwrap_or("")))?;
        }
        if task["timingMode"] == "range" {
            require(date(&task["startAt"]))?;
            let start = chrono::DateTime::parse_from_rfc3339(task["startAt"].as_str().unwrap()).unwrap();
            let end = chrono::DateTime::parse_from_rfc3339(task["dueDate"].as_str().unwrap()).unwrap();
            require(start < end)?;
        } else {
            require(task.get("startAt").is_none())?;
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
    if let Some(music)=data.settings.get("focusMusic"){require(music["enabled"].is_boolean()&&number(&music["volume"],0.0,100.0))?;}
    if let Some(voice)=data.settings.get("ttsVoice"){require(["girl","boy"].contains(&voice.as_str().unwrap_or("")))?;}
    if let Some(profile)=data.settings.get("profileSurvey"){
        require(["complete","deferred"].contains(&profile["status"].as_str().unwrap_or(""))&&profile["minutes"].as_u64().map_or(false,|n|n>=5&&n<=480))?;
        require(["morning","afternoon","evening","flexible"].contains(&profile["rhythm"].as_str().unwrap_or("")))?;
        for key in ["goals","interests"]{require(profile[key].as_str().map_or(false,|s|s.chars().count()<=500))?;}
    }
    for (key,limit) in [("dailyPlans",90),("weeklyReports",52),("journalEntries",200)]{
        let empty=Value::Array(vec![]);
        if let Some(value)=data.settings.get(key).or_else(||if key=="journalEntries"&&data.settings.get("journalDraft").is_some(){Some(&empty)}else{None}){let entries=value.as_array().ok_or("INVALID_COMPANION_RECORDS")?;require(entries.len()<=limit)?;let mut ids=HashSet::new();let mut image_bytes=0;
            let draft=data.settings.get("journalDraft").filter(|v|!v.is_null());
            for entry in entries.iter().chain(if key=="journalEntries"{draft}else{None}){
                require(entry["id"].as_str().map_or(false,|id|valid_id(id)&&(ids.insert(id)||draft.map_or(false,|d|std::ptr::eq(d,entry))))&&date(&entry["createdAt"]))?;
                if key=="journalEntries"{
                    require(date(&entry["updatedAt"]))?;
                    for (field,max) in [("title",100),("body",12000),("reflection",2500)]{require(entry[field].as_str().map_or(false,|s|s.chars().count()<=max))?;}
                    let images=entry["images"].as_array().ok_or("INVALID_JOURNAL_IMAGES")?;require(images.len()<=6)?;
                    for image in images{let text=image.as_str().ok_or("INVALID_JOURNAL_IMAGE")?;require(text.len()<=600000&&["data:image/jpeg;base64,","data:image/png;base64,","data:image/webp;base64,"].iter().any(|prefix|text.starts_with(prefix)))?;image_bytes+=text.len();}
                    let strokes=entry["strokes"].as_array().ok_or("INVALID_JOURNAL_DRAWING")?;require(strokes.len()<=100)?;for stroke in strokes{let points=stroke.as_array().ok_or("INVALID_STROKE")?;require(points.len()<=800)?;for point in points{require(number(&point["x"],0.0,1000.0)&&number(&point["y"],0.0,1000.0))?;}}
                    let stickers=entry["stickers"].as_array().ok_or("INVALID_STICKERS")?;require(stickers.len()<=30)?;for sticker in stickers{require(number(&sticker["x"],0.0,100.0)&&number(&sticker["y"],0.0,100.0)&&["♡","★","✿","☀","🐾"].contains(&sticker["symbol"].as_str().unwrap_or("")))?;}
                }else{
                    require(entry["summary"].as_str().map_or(false,|s|s.chars().count()<=2500))?;
                    if key=="dailyPlans"{let slots=entry["slots"].as_array().ok_or("INVALID_PLAN_SLOTS")?;require(slots.len()<=30)?;for slot in slots{require(date(&slot["start"])&&date(&slot["end"])&&nonempty(&slot["taskId"])&&slot["title"].is_string()&&slot["reason"].is_string()&&slot["firstStep"].is_string()&&slot["fixed"].is_boolean())?;}}
                    else{let evidence=&entry["evidence"];for field in ["completed","open","missingCompletionDate","weekToDate"]{require(number(&evidence[field],0.0,MAX_REVISION as f64))?;}require(evidence["weeks"].as_array().map_or(false,|a|a.len()==4)&&evidence["days"].as_array().map_or(false,|a|a.len()==7))?;}
                }
            }require(image_bytes<=20000000)?;
        }
    }
    if let Some(value) = data.settings.get("petPersonality") {
        require(["gentle","tsundere","witty","humorous","cool","soft"].contains(&value.as_str().unwrap_or("")))?;
    }
    if let Some(value) = data.settings.get("petInteractionCount") { require(value.as_u64().map_or(false, |n| n <= MAX_REVISION))?; }
    for (key, limit, width) in [("achievementRewards",100,80),("confirmedConflicts",2000,500)] {
        if let Some(value) = data.settings.get(key) {
            let values=value.as_array().ok_or("INVALID_PRODUCT_SETTING")?;
            require(values.len() <= limit)?;
            for entry in values { require(entry.as_str().map_or(false, |s| s.len() <= width))?; }
        }
    }
    if let Some(value) = data.settings.get("anniversaries") {
        let notes=value.as_array().ok_or("INVALID_ANNIVERSARIES")?;require(notes.len() <= 50)?;
        let mut ids=HashSet::new();
        for note in notes {
            require(note["id"].as_str().map_or(false, |id| valid_id(id) && ids.insert(id)) && nonempty(&note["title"]) && note["title"].as_str().unwrap().chars().count() <= 80)?;
            require(note["date"].as_str().map_or(false, |s| chrono::NaiveDate::parse_from_str(s,"%Y-%m-%d").is_ok()) && note["yearly"].is_boolean())?;
            require(["sunshine","mint","rose","sky"].contains(&note["style"].as_str().unwrap_or("")))?;
            if let Some(image)=note.get("image") { require(image.as_str().map_or(false, |s| s.len()<=600000 && ["data:image/png;base64,","data:image/jpeg;base64,","data:image/webp;base64,"].iter().any(|prefix|s.starts_with(prefix))))?; }
        }
    }
    if let Some(value) = data.settings.get("scheduledJobs") {
        let jobs=value.as_array().ok_or("INVALID_SCHEDULED_JOBS")?;require(jobs.len()<=30)?;
        let mut ids=HashSet::new();
        for job in jobs {
            require(job["id"].as_str().map_or(false, |id| valid_id(id) && ids.insert(id)) && nonempty(&job["title"]) && nonempty(&job["prompt"]))?;
            require(job["title"].as_str().unwrap().chars().count()<=80 && job["prompt"].as_str().unwrap().chars().count()<=1000)?;
            require(["reminder","assistant","news"].contains(&job["kind"].as_str().unwrap_or("")) && ["once","daily","weekdays"].contains(&job["repeat"].as_str().unwrap_or("")))?;
            require(job["time"].as_str().map_or(false, |s| s.len()==5 && chrono::NaiveTime::parse_from_str(s,"%H:%M").is_ok()) && date(&job["nextRun"]) && job["enabled"].is_boolean())?;
            if let Some(last)=job.get("lastRun") {require(date(last))?;}
            if let Some(result)=job.get("result") {require(result.as_str().map_or(false, |s| s.chars().count()<=2400))?;}
            if let Some(state)=job.get("runState") {require(["running","succeeded","failed","interrupted"].contains(&state.as_str().unwrap_or("")))?;}
            for key in ["error","notificationPending"] {if let Some(flag)=job.get(key) {require(flag.is_boolean())?;}}
        }
    }
    if let Some(journal) = data.settings.get("focusSpace") {
        require(journal["version"] == 1 && journal.get("active").is_some())?;
        let history = journal["history"].as_array().ok_or("INVALID_FOCUS_HISTORY")?;
        require(history.len() <= 50000)?;
        let mut focus_ids = HashSet::new();
        for (entry, finished) in history.iter().map(|entry| (entry, true)).chain(if journal["active"].is_null() { None } else { Some((&journal["active"], false)) }) {
            let id = entry["id"].as_str().ok_or("INVALID_FOCUS_ID")?;
            require(valid_id(id) && id.len() <= 80 && focus_ids.insert(id))?;
            for key in ["startedAt", "updatedAt", "phaseStartedAt", "phaseEndAt"] { require(date(&entry[key]))?; }
            let parse = |key: &str| chrono::DateTime::parse_from_rfc3339(entry[key].as_str().unwrap()).unwrap();
            require(parse("updatedAt") >= parse("startedAt") && parse("phaseEndAt") >= parse("phaseStartedAt"))?;
            let config = &entry["config"];
            let focus = config["focusMinutes"].as_u64().filter(|n| *n >= 1 && *n <= 180).ok_or("INVALID_FOCUS_CONFIG")?;
            let cycles = config["cycles"].as_u64().filter(|n| *n >= 1 && *n <= 12).ok_or("INVALID_FOCUS_CONFIG")?;
            require(config["breakMinutes"].as_u64().map_or(false, |n| n >= 1 && n <= 60))?;
            require(entry["focusMs"].as_u64().map_or(false, |n| n <= focus * cycles * 60000)
                && entry["completedCycles"].as_u64().map_or(false, |n| n <= cycles)
                && entry["quoteOffset"].as_u64().map_or(false, |n| n <= 4)
                && ["focus", "break", "complete"].contains(&entry["phase"].as_str().unwrap_or("")))?;
            if finished {
                require(date(&entry["endedAt"]) && entry["phase"] == "complete"
                    && ["completed", "exited", "interrupted"].contains(&entry["reason"].as_str().unwrap_or("")))?;
            } else { require(entry.get("endedAt").is_none() && entry.get("reason").is_none() && entry["phase"] != "complete")?; }
        }
    }
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
    fn focus_records_are_validated_and_preserved_with_the_account() {
        let directory = Directory::new();
        let store = directory.store();
        let initial = store.initialize("A", empty()).unwrap();
        let mut data = initial.data.clone();
        let entry = json!({"id":"focus-one", "startedAt":"2026-10-16T08:00:00Z", "updatedAt":"2026-10-16T08:00:30Z", "phaseStartedAt":"2026-10-16T08:00:00Z", "phaseEndAt":"2026-10-16T08:01:00Z", "config":{"focusMinutes":1,"breakMinutes":1,"cycles":2},"phase":"complete","focusMs":30000,"completedCycles":0,"quoteOffset":0,"endedAt":"2026-10-16T08:00:30Z","reason":"exited"});
        data.settings["focusSpace"] = json!({"version":1,"history":[entry],"active":null});
        let saved = store.commit("A", initial.revision, "focus-save", data.clone()).unwrap();
        assert_eq!(store.read("A").unwrap().unwrap(), saved);
        data.settings["focusSpace"]["history"][0]["focusMs"] = json!(999999999);
        assert!(store.commit("A", saved.revision, "invalid-focus", data).is_err());
        assert_eq!(store.read("A").unwrap().unwrap(), saved);
    }
    #[test]
    fn journal_edit_draft_and_voice_preferences_persist_without_damaging_prior_record() {
        let directory=Directory::new();let store=directory.store();let initial=store.initialize("A",empty()).unwrap();let mut data=initial.data;
        let entry=json!({"id":"page-one","createdAt":"2026-10-17T01:00:00Z","updatedAt":"2026-10-17T01:00:00Z","title":"Today","body":"My own words","reflection":"AI note","images":[],"stickers":[{"symbol":"♡","x":25,"y":30}],"strokes":[[{"x":0,"y":10},{"x":100,"y":200}]]});
        data.settings["journalEntries"]=json!([entry.clone()]);data.settings["journalDraft"]=entry;data.settings["journalDraft"]["body"]=json!("Unsaved edits");data.settings["ttsVoice"]=json!("girl");data.settings["focusMusic"]=json!({"enabled":true,"volume":40});
        let saved=store.commit("A",initial.revision,"journal-edit",data.clone()).unwrap();assert_eq!(store.read("A").unwrap().unwrap(),saved);
        data.settings["journalDraft"]["strokes"][0][0]["x"]=json!(1001);assert!(store.commit("A",saved.revision,"bad-stroke",data).is_err());assert_eq!(store.read("A").unwrap().unwrap(),saved);
    }
    #[test]
    fn anniversary_and_schedule_validation_preserves_durable_state_on_invalid_input() {
        let directory = Directory::new(); let store=directory.store();
        let initial=store.initialize("A",empty()).unwrap(); let mut data=initial.data.clone();
        data.settings["anniversaries"]=json!([{"id":"note-one","title":"Birthday","date":"2000-02-29","yearly":true,"style":"mint"}]);
        data.settings["scheduledJobs"]=json!([{"id":"job-one","title":"Morning","prompt":"News","kind":"news","repeat":"daily","time":"08:00","enabled":true,"nextRun":"2026-10-17T00:00:00Z"}]);
        data.settings["petPersonality"]=json!("soft");
        let saved=store.commit("A",initial.revision,"product-save",data.clone()).unwrap();
        assert_eq!(store.read("A").unwrap().unwrap(),saved);
        data.settings["anniversaries"][0]["date"]=json!("2026-02-30");
        assert!(store.commit("A",saved.revision,"bad-note",data).is_err());
        let mut data=saved.data.clone();data.settings["scheduledJobs"][0]["time"]=json!("25:00");
        assert!(store.commit("A",saved.revision,"bad-job",data).is_err());
        assert_eq!(store.read("A").unwrap().unwrap(),saved);
    }
    #[test]
    fn scheduled_ranges_persist_and_invalid_times_preserve_the_existing_revision() {
        let directory = Directory::new();
        let store = directory.store();
        directory.legacy(&populated());
        let original = store.initialize("A", populated()).unwrap();
        let mut scheduled = original.data.clone();
        scheduled.tasks[0]["timingMode"] = json!("range");
        scheduled.tasks[0]["startAt"] = json!("2026-10-15T22:00:00.000Z");
        let saved = store.commit("A", original.revision, "range-save", scheduled.clone()).unwrap();
        assert_eq!(store.read("A").unwrap().unwrap().data.tasks[0]["startAt"], scheduled.tasks[0]["startAt"]);
        scheduled.tasks[0]["startAt"] = scheduled.tasks[0]["dueDate"].clone();
        assert!(store.commit("A", saved.revision, "invalid-range", scheduled).is_err());
        assert_eq!(store.read("A").unwrap().unwrap(), saved);
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
