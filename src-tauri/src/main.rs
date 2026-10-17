// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayMenu, SystemTrayMenuItem, CustomMenuItem, SystemTrayEvent, WindowEvent, RunEvent};
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
mod storage_paths;
mod business_store;
mod instance_lock;
mod speech;
mod desktop_notifications;
#[tauri::command]
fn desktop_notification_status(window:tauri::Window,app:tauri::AppHandle)->Result<bool,String>{main_window_only(&window)?;desktop_notifications::register(&app.config().tauri.bundle.identifier)?;Ok(true)}
#[tauri::command]
fn desktop_notify(window:tauri::Window,app:tauri::AppHandle,title:String,body:String)->Result<(),String>{main_window_only(&window)?;desktop_notifications::show(&app.config().tauri.bundle.identifier,&title,&body)}
#[tauri::command]
fn set_notification_account(window:tauri::Window,owner:Option<String>,locale:String,state:tauri::State<desktop_notifications::NotificationAccount>)->Result<(),String>{
 main_window_only(&window)?;if !["zh-CN","en-US"].contains(&locale.as_str())||owner.as_ref().map_or(false,|s|s.len()>128||!s.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-')){return Err("INVALID_ACCOUNT".into());}
 *state.0.lock().map_err(|_|"NOTIFICATION_STATE")?=owner.map(|s|(s,locale));state.1.fetch_add(1,Ordering::SeqCst);Ok(())
}

#[tauri::command]
async fn recognize_voice(window: tauri::Window, locale: String, request_id: String, state: tauri::State<'_, speech::VoiceState>) -> Result<String, String> {
    main_window_only(&window)?;
    let (cancel, guard) = state.begin(&request_id)?;
    tauri::async_runtime::spawn_blocking(move || { let _guard = guard; speech::recognize(&locale, cancel) }).await.map_err(|_| "SPEECH_UNAVAILABLE".to_string())?
}
#[tauri::command]
fn cancel_voice(window: tauri::Window, request_id: String, state: tauri::State<speech::VoiceState>) -> Result<(), String> {
    main_window_only(&window)?; state.cancel(&request_id); Ok(())
}

#[derive(Default)]
struct ShutdownState { pending: Mutex<Option<String>>, approved: AtomicBool }

fn request_shutdown(app: &tauri::AppHandle) {
    let state = app.state::<ShutdownState>();
    if let Ok(mut pending) = state.pending.lock() {
        let id = pending.get_or_insert_with(|| format!("exit-{}", chrono::Utc::now().timestamp_millis()));
        if app.emit_to("main", "prepare-exit", id.clone()).is_err() { *pending = None; }
    };
}

fn main_window_only(window: &tauri::Window) -> Result<(), String> {
    if window.label() == "main" { Ok(()) } else { Err("Only the main window may change business data".into()) }
}

#[tauri::command]
fn set_ui_language(locale: String, app: tauri::AppHandle) -> Result<(), String> {
    let titles = match locale.as_str() {
        "zh-CN" => ["显示／隐藏主窗口", "开发者工具", "退出"],
        "en-US" => ["Show/Hide Main Window", "Open DevTools", "Quit"],
        _ => return Err("Unsupported display language".into()),
    };
    for (id, title) in ["toggle_main", "open_devtools", "quit"].iter().zip(titles) {
        app.tray_handle().get_item(id).set_title(title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_business_state(user_id: String, store: tauri::State<business_store::BusinessStore>) -> Result<Option<business_store::Snapshot>, String> {
    store.read(&user_id)
}

#[tauri::command]
fn initialize_business_state(window: tauri::Window, user_id: String, data: business_store::BusinessData, store: tauri::State<business_store::BusinessStore>) -> Result<business_store::Snapshot, String> {
    main_window_only(&window)?;
    store.initialize(&user_id, data)
}

#[tauri::command]
fn commit_business_state(window: tauri::Window, user_id: String, expected_revision: u64, operation_id: String, data: business_store::BusinessData, store: tauri::State<business_store::BusinessStore>, shutdown: tauri::State<ShutdownState>,notifications:tauri::State<desktop_notifications::NotificationAccount>) -> Result<business_store::Snapshot, String> {
    main_window_only(&window)?;
    if shutdown.approved.load(Ordering::SeqCst) { return Err("Application is closing".into()); }
    let saved=store.commit(&user_id, expected_revision, &operation_id, data)?;notifications.1.fetch_add(1,Ordering::SeqCst);Ok(saved)
}

#[tauri::command]
fn complete_shutdown(window: tauri::Window, request_id: String, app: tauri::AppHandle, state: tauri::State<ShutdownState>) -> Result<(), String> {
    main_window_only(&window)?;
    let mut pending = state.pending.lock().map_err(|_| "Exit state unavailable")?;
    if pending.as_deref() != Some(&request_id) { return Err("Exit request has changed".into()); }
    state.approved.store(true, Ordering::SeqCst);
    *pending = None;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn cancel_shutdown(window: tauri::Window, state: tauri::State<ShutdownState>) -> Result<(), String> {
    main_window_only(&window)?;
    *state.pending.lock().map_err(|_| "Exit state unavailable")? = None;
    Ok(())
}

// 全局日志文件句柄
struct Logger {
    file: Mutex<std::fs::File>,
}

impl Logger {
    fn new(log_path: std::path::PathBuf) -> Self {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .expect("Failed to open log file");
        
        Logger {
            file: Mutex::new(file),
        }
    }
    
    fn log(&self, message: &str) {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let log_line = format!("[{}] {}\n", timestamp, message);
        
        if let Ok(mut file) = self.file.lock() {
            let _ = file.write_all(log_line.as_bytes());
            let _ = file.flush();
        }
        
        println!("{}", log_line.trim());
    }
}

fn main() {
    let context = tauri::generate_context!();
    let Some(app_directory) = tauri::api::path::app_data_dir(context.config()) else {
        eprintln!("Application data directory is unavailable"); return;
    };
    // Acquire before any WebView or writable application state is created.
    let _instance_lock = match instance_lock::InstanceLock::acquire(&app_directory) {
        Ok(lock) => lock,
        Err(error) => {
            tauri::api::dialog::blocking::message(None::<&tauri::Window>, "MotiBuddy", format!("应用已在运行，或数据目录无法锁定。请使用已打开的窗口。\n{error}"));
            return;
        }
    };
    // 创建系统托盘菜单
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("toggle_main", "Show/Hide Main Window"))
        .add_item(CustomMenuItem::new("open_devtools", "Open DevTools"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(ShutdownState::default())
        .manage(speech::VoiceState::default())
        .manage(desktop_notifications::NotificationAccount::default())
        .manage(business_store::BusinessStore::new(app_directory.join("MotiBuddyData")))
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                match id.as_str() {
                    "quit" => {
                        request_shutdown(app);
                    }
                    "toggle_main" => {
                        if let Some(main_window) = app.get_window("main") {
                            if main_window.is_visible().unwrap_or(false) {
                                let _ = main_window.hide();
                            } else {
                                let _ = main_window.show();
                                let _ = main_window.set_focus();
                            }
                        }
                    }
                    "open_devtools" => {
                        if let Some(main_window) = app.get_window("main") {
                            // Ensure window is visible and focused
                            let _ = main_window.show();
                            let _ = main_window.set_focus();
                            
                            // Inject a script to show debug info on the page
                            match main_window.eval(r#"
                                (function() {
                                    // Create debug panel
                                    let debugPanel = document.getElementById('tauri-debug-panel');
                                    if (!debugPanel) {
                                        debugPanel = document.createElement('div');
                                        debugPanel.id = 'tauri-debug-panel';
                                        debugPanel.style.cssText = 'position:fixed;top:10px;right:10px;width:400px;max-height:80vh;overflow:auto;background:rgba(0,0,0,0.9);color:#0f0;padding:10px;z-index:99999;font-family:monospace;font-size:12px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
                                        document.body.appendChild(debugPanel);
                                    }
                                    
                                    // Collect debug info
                                    let info = '=== Tauri Debug Info ===\n\n';
                                    info += 'User Agent: ' + navigator.userAgent + '\n\n';
                                    info += 'LocalStorage Keys (' + localStorage.length + '):\n';
                                    for (let i = 0; i < localStorage.length; i++) {
                                        let key = localStorage.key(i);
                                        let value = localStorage.getItem(key);
                                        info += '  ' + key + ': ' + (value ? value.substring(0, 100) + '...' : 'null') + '\n';
                                    }
                                    
                                    debugPanel.textContent = info;
                                    debugPanel.style.display = 'block';
                                    console.log('Debug panel created/updated');
                                    return 'success';
                                })()
                            "#) {
                                Ok(result) => {
                                    println!("Debug panel result: {:?}", result);
                                }
                                Err(e) => {
                                    println!("Failed to create debug panel: {}", e);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        })
        .setup(|app| {
            let notification_app=app.handle();
            std::thread::spawn(move||{let mut delivered=std::collections::HashSet::new();let mut observed=u64::MAX;let mut next_check=chrono::Utc::now();loop{std::thread::sleep(std::time::Duration::from_secs(5));if notification_app.state::<ShutdownState>().approved.load(Ordering::SeqCst){break;}
                let generation=notification_app.state::<desktop_notifications::NotificationAccount>().1.load(Ordering::SeqCst);if generation==observed&&chrono::Utc::now()<next_check{continue;}observed=generation;next_check=chrono::Utc::now()+chrono::Duration::seconds(60);
                let account=notification_app.state::<desktop_notifications::NotificationAccount>().0.lock().ok().and_then(|s|s.clone());
                let Some((owner,locale))=account else{continue};let store=notification_app.state::<business_store::BusinessStore>();let Ok(Some(snapshot))=store.read(&owner) else{continue};let mut data=snapshot.data;
                for task in data.tasks.as_array().into_iter().flatten(){if task["status"]=="completed"{continue;}for reminder in task["reminders"].as_array().into_iter().flatten(){if reminder["sent"]==true{continue;}if let Some(at)=reminder["time"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()){let at=at.with_timezone(&chrono::Utc);if at>chrono::Utc::now()&&at<next_check{next_check=at;}}}}
                let changed=desktop_notifications::process(&mut data,&owner,&locale,chrono::Utc::now(),&mut delivered,|title,body|{let account=notification_app.state::<desktop_notifications::NotificationAccount>();let guard=account.0.lock().map_err(|_|"NOTIFICATION_STATE".to_string())?;if !guard.as_ref().map_or(false,|s|s.0==owner){return Err("ACCOUNT_CHANGED".into());}desktop_notifications::show(&notification_app.config().tauri.bundle.identifier,title,body)});
                let same=notification_app.state::<desktop_notifications::NotificationAccount>().0.lock().ok().and_then(|s|s.clone()).map_or(false,|s|s.0==owner);
                if changed&&same&&!notification_app.state::<ShutdownState>().approved.load(Ordering::SeqCst){let operation=format!("reminder-{}",chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default());if let Ok(saved)=store.commit(&owner,snapshot.revision,&operation,data){let prefix=format!("{}|",owner);delivered.retain(|key|!key.starts_with(&prefix));let _=notification_app.emit_to("main","native-business-updated",serde_json::json!({"userId":owner,"revision":saved.revision}));}}
            }});
            // 获取应用数据目录
            let app_dir = app.path_resolver().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).unwrap_or_default();
            
            // 创建日志文件路径
            let log_path = app_dir.join("app.log");
            println!("App data directory: {:?}", app_dir);
            println!("Log file path: {:?}", log_path);
            
            // 创建日志记录器
            let logger = std::sync::Arc::new(Logger::new(log_path));
            logger.log("Application started");
            
            // 检查资源文件是否存在
            let resource_dir = app.path_resolver().resource_dir();
            logger.log(&format!("Resource directory: {:?}", resource_dir));
            
            // 将日志记录器存储在应用状态中
            app.manage(logger.clone());
            
            // 获取主窗口
            let _main_window = app.get_window("main").unwrap();
            
            // 打开开发者工具（用于调试）- 在发布版本中也启用
            #[cfg(debug_assertions)]
            _main_window.open_devtools();
            
            // 为 widget 窗口也添加打开开发者工具的功能
            #[cfg(debug_assertions)]
            let app_handle = app.handle();
            #[cfg(debug_assertions)]
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                if let Some(widget_window) = app_handle.get_window("widget") {
                    widget_window.open_devtools();
                }
            });
            
            Ok(())
        })
        .on_window_event(|event| match event.event() {
            WindowEvent::CloseRequested { api, .. } => {
                // 阻止默认关闭行为，改为隐藏窗口
                api.prevent_close();
                let window = event.window();
                if window.label() == "main" {
                    window.hide().unwrap();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            hide_widget_window,
            check_widget_visibility,
            toggle_widget_window,
            get_data_directory,
            log_message,
            load_widget_data,
            start_dragging,
            move_widget_window,
            log_widget_debug,
            data_file_exists,
            read_business_state,
            initialize_business_state,
            commit_business_state,
            complete_shutdown,
            cancel_shutdown,
            set_ui_language,
            recognize_voice,
            cancel_voice,
            desktop_notification_status,
            desktop_notify,
            set_notification_account,
        ])
        .build(context)
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            RunEvent::ExitRequested { api, .. } => {
                if !_app_handle.state::<ShutdownState>().approved.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
            RunEvent::Exit => {
                _app_handle.state::<speech::VoiceState>().cancel_all();
                // 应用退出时关闭小组件窗口
                if let Some(widget) = _app_handle.get_window("widget") {
                    let _ = widget.close();
                }
            }
            _ => {}
        });
}

#[tauri::command]
fn data_file_exists(filename: String, app_handle: tauri::AppHandle) -> Result<bool, String> {
    if !storage_paths::valid_data_filename(&filename) {
        return Err("Invalid data filename".to_string());
    }
    let root = app_handle.path_resolver().app_data_dir().ok_or("App data directory unavailable")?;
    storage_paths::data_file_exists(&root.join("MotiBuddyData").join(filename))
        .map_err(|_| "Data file metadata could not be read; existing data has been preserved".to_string())
}

// Widget views are projections of the committed account snapshot.
#[tauri::command]
fn load_widget_data(user_id: Option<String>, store: tauri::State<business_store::BusinessStore>) -> Result<serde_json::Value, String> {
    let Some(owner) = user_id.filter(|id| !id.is_empty()) else {
        return Ok(serde_json::json!({ "user_id": null, "tasks": [], "pet": null, "timestamp": 0, "revision": 0 }));
    };
    let snapshot = store.read(&owner)?.ok_or("Account data is unavailable; sign in again")?;
    Ok(business_store::widget_projection(&snapshot))
}

// 显示主窗口
#[tauri::command]
fn show_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log("show_main_window called");
    
    if let Some(main_window) = app_handle.get_window("main") {
        main_window.show().map_err(|e| {
            let err = format!("Failed to show main window: {}", e);
            logger.log(&err);
            err
        })?;
        main_window.set_focus().map_err(|e| {
            let err = format!("Failed to focus main window: {}", e);
            logger.log(&err);
            err
        })?;
        logger.log("Main window shown successfully");
    } else {
        logger.log("Main window not found");
    }
    Ok(())
}

// 隐藏小组件窗口
#[tauri::command]
fn hide_widget_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log("hide_widget_window called");
    
    if let Some(widget_window) = app_handle.get_window("widget") {
        widget_window.hide().map_err(|e| {
            let err = format!("Failed to hide widget: {}", e);
            logger.log(&err);
            err
        })?;
        logger.log("Widget window hidden successfully");
    } else {
        logger.log("Widget window not found");
    }
    Ok(())
}

// 检查小组件窗口是否可见
#[tauri::command]
fn check_widget_visibility(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    
    if let Some(widget_window) = app_handle.get_window("widget") {
        match widget_window.is_visible() {
            Ok(visible) => {
                return Ok(visible);
            }
            Err(e) => {
                logger.log(&format!("Failed to check widget visibility: {}", e));
                return Ok(false);
            }
        }
    }
    Ok(false)
}

// 切换小组件窗口显示状态
#[tauri::command]
fn toggle_widget_window(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log("toggle_widget_window called");
    
    // 获取屏幕尺寸，计算右上角位置
    let monitor = app_handle
        .get_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());
    
    let (x, y) = if let Some(monitor) = monitor {
        let size = monitor.size();
        let x = size.width as f64 - 320.0;
        let y = 20.0;
        (x, y)
    } else {
        (100.0, 100.0)
    };
    
    if let Some(widget_window) = app_handle.get_window("widget") {
        logger.log("Widget window found");
        let is_visible = widget_window.is_visible().map_err(|e| {
            let err = format!("Failed to check widget visibility: {}", e);
            logger.log(&err);
            err
        })?;
        
        if is_visible {
            widget_window.hide().map_err(|e| {
                let err = format!("Failed to hide widget: {}", e);
                logger.log(&err);
                err
            })?;
            logger.log("Widget window hidden");
            Ok(false)
        } else {
            // 设置位置
            if let Err(e) = widget_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 })) {
                logger.log(&format!("Failed to set position: {}", e));
            }
            
            // 数据加载已由前端处理，不再注入初始数据
            logger.log("Widget window shown, data will be loaded by frontend");
            
            // 拖动功能已在前端实现，不需要后端注入拖动层
            logger.log("Widget window created, drag handled by frontend");
            
            widget_window.show().map_err(|e| {
                let err = format!("Failed to show widget: {}", e);
                logger.log(&err);
                err
            })?;
            widget_window.set_focus().map_err(|e| {
                let err = format!("Failed to focus widget: {}", e);
                logger.log(&err);
                err
            })?;
            logger.log("Widget window shown");
            Ok(true)
        }
    } else {
        logger.log("Widget window not found in config");
        Err("Widget window not found".to_string())
    }
}

// 获取数据目录路径
#[tauri::command]
fn get_data_directory(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path_resolver().app_data_dir()
        .ok_or("Failed to get app data dir")?;
    Ok(app_dir.to_string_lossy().to_string())
}

// 记录日志消息
#[tauri::command]
fn log_message(message: String, app_handle: tauri::AppHandle) {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log(&message);
}

// 开始拖动窗口
#[tauri::command]
fn start_dragging(app_handle: tauri::AppHandle) -> Result<(), String> {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log("start_dragging called");
    
    if let Some(widget_window) = app_handle.get_window("widget") {
        widget_window.start_dragging().map_err(|e| {
            let err = format!("Failed to start dragging: {}", e);
            logger.log(&err);
            err
        })?;
        logger.log("Dragging started");
    }
    Ok(())
}

// 移动 widget 窗口（用于平滑拖动）
#[tauri::command]
fn move_widget_window(delta_x: i32, delta_y: i32, app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(widget_window) = app_handle.get_window("widget") {
        let current_pos = widget_window.outer_position().map_err(|e| e.to_string())?;
        let new_x = current_pos.x + delta_x;
        let new_y = current_pos.y + delta_y;
        widget_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: new_x, y: new_y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// 记录 widget 调试日志
#[tauri::command]
fn log_widget_debug(message: String, app_handle: tauri::AppHandle) {
    let logger = app_handle.state::<std::sync::Arc<Logger>>();
    logger.log(&format!("[WIDGET] {}", message));
}
