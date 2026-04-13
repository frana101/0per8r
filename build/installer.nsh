; Runs when the NSIS uninstaller removes 0per8r — clears WinHTTP so browsing is not stuck on 127.0.0.1:3128
!macro customUnInstall
  DetailPrint "0per8r: resetting WinHTTP proxy (uninstall cleanup)..."
  ExecWait 'netsh winhttp reset proxy'
  ExecWait 'ipconfig /flushdns'
!macroend
