use std::{
    fs::{self, File, OpenOptions},
    io,
    path::Path,
};

/// The OS releases this handle on crash. The existence of the file is not the lock.
pub struct InstanceLock {
    _file: File,
}
impl InstanceLock {
    pub fn acquire(directory: &Path) -> io::Result<Self> {
        fs::create_dir_all(directory)?;
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0);
        }
        #[cfg(not(windows))]
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Instance locking is currently supported on Windows only",
        ));
        #[cfg(windows)]
        Ok(Self {
            _file: options.open(directory.join("business.instance.lock"))?,
        })
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn lock_prevents_a_second_writer_and_is_released_with_the_handle() {
        let root =
            std::env::temp_dir().join(format!("motibuddy-instance-test-{}", std::process::id()));
        let first = InstanceLock::acquire(&root).unwrap();
        assert!(InstanceLock::acquire(&root).is_err());
        drop(first);
        let next = InstanceLock::acquire(&root).unwrap();
        drop(next);
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("motibuddy-instance-test-"));
        fs::remove_dir_all(root).unwrap();
    }
}
