use std::{fs, io, path::Path};

/// Only application-owned JSON basenames and their recovery sidecars are accepted.
pub fn valid_data_filename(filename: &str) -> bool {
    let base = filename
        .strip_suffix(".bak.tmp")
        .or_else(|| filename.strip_suffix(".bak"))
        .or_else(|| filename.strip_suffix(".tmp"))
        .unwrap_or(filename);
    if base == "user.json" {
        return true;
    }
    let Some(stem) = base.strip_suffix(".json") else { return false };
    let owner = ["migration_pet_", "tasks_", "pet_", "settings_"]
        .iter()
        .find_map(|prefix| stem.strip_prefix(prefix));
    owner.map_or(false, |id| {
        !id.is_empty()
            && id.len() <= 128
            && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    })
}

/// Path::exists() hides access errors. Only a real NotFound error means missing data.
pub fn data_file_exists(path: &Path) -> io::Result<bool> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => Ok(true),
        Ok(_) => Err(io::Error::new(io::ErrorKind::InvalidData, "Expected a data file")),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            // Windows also reports PATH_NOT_FOUND when an ancestor is a file.
            // Inspect ancestors so a broken data directory is not a new profile.
            for parent in path.ancestors().skip(1) {
                match fs::metadata(parent) {
                    Ok(metadata) if metadata.is_dir() => return Ok(false),
                    Ok(_) => return Err(io::Error::new(io::ErrorKind::InvalidData, "Expected a data directory")),
                    Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(error),
                }
            }
            Ok(false)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, path::PathBuf, sync::atomic::{AtomicUsize, Ordering}};
    static NEXT: AtomicUsize = AtomicUsize::new(0);

    struct TestDirectory(PathBuf);
    impl TestDirectory {
        fn new() -> Self {
            let path = env::temp_dir().join(format!("motibuddy-path-test-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(env::temp_dir().as_path()));
            assert!(self.0.file_name().unwrap().to_string_lossy().starts_with("motibuddy-path-test-"));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn accepts_only_owned_files_and_sidecars() {
        for name in ["tasks_123.json", "pet_A-b.json.bak", "settings_a_b.json.tmp", "user.json.bak.tmp", "migration_pet_A.json", "migration_pet_A.json.bak.tmp"] {
            assert!(valid_data_filename(name), "{name}");
        }
        for name in ["tasks.json", "tasks_.json", "tasks_../other.json", "../user.json", "C:\\user.json", "widget_data_1.json", "tasks_A.json.tmp.tmp", "tasks_A.json:secret"] {
            assert!(!valid_data_filename(name), "{name}");
        }
        assert!(!valid_data_filename(&format!("tasks_{}.json", "a".repeat(129))));
        assert!(valid_data_filename(&format!("migration_pet_{}.json", "a".repeat(128))));
        assert!(!valid_data_filename(&format!("migration_pet_{}.json", "a".repeat(129))));
    }

    #[test]
    fn missing_and_present_files_are_distinct() {
        let directory = TestDirectory::new();
        let path = directory.0.join("tasks_A.json");
        assert!(!data_file_exists(&path).unwrap());
        fs::write(&path, "[]").unwrap();
        assert!(data_file_exists(&path).unwrap());
    }

    #[test]
    fn a_directory_in_place_of_a_file_is_an_error() {
        let directory = TestDirectory::new();
        assert_eq!(data_file_exists(&directory.0).unwrap_err().kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn invalid_parent_access_is_not_reported_as_missing() {
        let directory = TestDirectory::new();
        let parent = directory.0.join("not-a-directory");
        fs::write(&parent, "file").unwrap();
        assert!(data_file_exists(&parent.join("tasks_A.json")).is_err());
    }
}
