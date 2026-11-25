fn main() {
    // The app version lives in ../package.json (tauri.conf.json points at it) and is
    // compiled into the binary, so a version bump there must trigger a rebuild.
    println!("cargo:rerun-if-changed=../package.json");
    tauri_build::build()
}
