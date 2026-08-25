# SY-TFM Domain Context

## File navigation

- **Favorite folder**: A host-scoped bookmark for a remote directory. It has a display name and a remote path; selecting it navigates the active browser pane to that directory.
- **Host-scoped**: Each saved remote host owns an independent favorite-folder list. Favorites never cross hosts or panes.
- **Shared host data**: Favorite folders are part of the host record and travel with that host when the encrypted vault synchronizes between supported platforms. Platform-specific preferences remain platform-specific.
- **Folder-only selection**: Adding favorites is available when the effective selection contains one or more real directories. A file, the parent-directory placeholder, or a mixed file-and-directory selection is not eligible.

## Sync semantics

- **Idempotent add**: A favorite-folder path appears at most once in a host's list. Repeating the add operation does not create another entry.
- **Ordered favorites**: The list preserves the order in which favorite folders were first added.
