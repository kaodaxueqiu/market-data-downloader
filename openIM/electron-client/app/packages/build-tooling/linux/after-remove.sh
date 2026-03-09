#!/bin/sh
set -eu

APPS_LIST="OpenCorp-ER:opencorp-er
DEV-ER:dev-er"

stop_running_app() {
  exec_name="$1"

  if command -v pgrep >/dev/null 2>&1; then
    pids=$(pgrep -f "$exec_name" || true)
    if [ -n "$pids" ]; then
      for pid in $pids; do
        kill "$pid" 2>/dev/null || true
      done
      sleep 2 || true
      for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
      done
    fi
  fi
}

refresh_desktop_database() {
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
  fi
}

refresh_icon_cache() {
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor || true
  fi
}

cleanup_desktop_entry() {
  exec_name="$1"
  desktop_file="/usr/share/applications/$exec_name.desktop"

  rm -f "$desktop_file"
  rm -f "/usr/bin/$exec_name"
  rm -f "/usr/share/pixmaps/$exec_name.png"
  for size in 64 128 256 512; do
    rm -f "$(printf "/usr/share/icons/hicolor/%sx%s/apps/%s.png" "$size" "$size" "$exec_name")"
  done
  rm -f "/usr/share/icons/hicolor/0x0/apps/$exec_name.png"
}

detect_and_cleanup() {
  for dir in /opt/*; do
    [ -d "$dir" ] || continue
    resources_dir="$dir/resources"

    if [ ! -d "$resources_dir" ]; then
      continue
    fi
    if [ ! -f "$resources_dir/app.asar" ] && [ ! -d "$resources_dir/app.asar.unpacked" ]; then
      if ! ls "$resources_dir"/*.asar >/dev/null 2>&1; then
        continue
      fi
    fi

    product_name="$(basename "$dir")"
    exec_name=""

    if [ -x "$dir/$product_name" ]; then
      exec_name="$product_name"
    else
      exec_candidate="$(find "$dir" -maxdepth 1 -type f -perm -u+x ! -name 'chrome-sandbox' ! -name '*.so' ! -name '*.pak' ! -name '*.bin' 2>/dev/null | head -n 1)"
      if [ -n "$exec_candidate" ]; then
        exec_name="$(basename "$exec_candidate")"
      fi
    fi

    if [ -z "$exec_name" ]; then
      echo "Skip $product_name: no executable found in $dir"
      continue
    fi

    stop_running_app "$exec_name"
    cleanup_desktop_entry "$exec_name"
  done
}

# Dynamic cleanup for detected Electron apps.
detect_and_cleanup

# Fallback cleanup for known names (handles partial installs).
echo "$APPS_LIST" | while IFS=":" read -r _ exec_name; do
  [ -z "$exec_name" ] && continue
  stop_running_app "$exec_name"
  cleanup_desktop_entry "$exec_name"
done

refresh_desktop_database
refresh_icon_cache
