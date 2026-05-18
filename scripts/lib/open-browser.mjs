import { exec } from 'node:child_process'

/**
 * Open a URL in the default browser.
 * Falls back to printing the URL if the platform command fails.
 */
export function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`

  exec(cmd, (err) => {
    if (err) {
      console.warn(`Failed to open browser. Please open ${url} manually.`)
    }
  })
}
